import type {
  PluginHookAgent,
  PluginTurnOutcome,
} from "@getpaseo/plugin/server";
import type { AgentPermissionRequest } from "@getpaseo/protocol/agent-types";
import {
  buildPermissionPendingPayload,
  buildTurnCompletedPayload,
  buildTurnFailedPayload,
  type WakePayload,
} from "./payload";

export const PERMISSION_DEBOUNCE_MS = 10_000;
export const TURN_FAILURE_COOLDOWN_MS = 10 * 60_000;
export const TURN_COMPLETED_DEBOUNCE_MS = 2_000;

export interface Scheduler {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const defaultScheduler: Scheduler = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) =>
    clearTimeout(handle as Parameters<typeof clearTimeout>[0]),
};

export interface WakeFilterOptions {
  post: (payload: WakePayload, signal?: AbortSignal) => Promise<void>;
  permissionDebounceMs?: number;
  turnCooldownMs?: number;
  turnCompletedDebounceMs?: number;
  now?: () => number;
  scheduler?: Scheduler;
}

interface PendingPermission {
  agent: PluginHookAgent;
  request: AgentPermissionRequest;
  signal?: AbortSignal;
  timer: unknown;
}

export interface WakeFilter {
  permissionBefore(
    event: { agent: PluginHookAgent; request: AgentPermissionRequest },
    signal?: AbortSignal,
  ): void;
  permissionAfter(requestId: string): void;
  turnAfter(
    event: { agent: PluginHookAgent; outcome: PluginTurnOutcome },
    signal?: AbortSignal,
  ): void;
  agentGone(agentId: string): void;
  dispose(): void;
}

export function createWakeFilter(options: WakeFilterOptions): WakeFilter {
  const debounceMs = options.permissionDebounceMs ?? PERMISSION_DEBOUNCE_MS;
  const cooldownMs = options.turnCooldownMs ?? TURN_FAILURE_COOLDOWN_MS;
  const completedDebounceMs =
    options.turnCompletedDebounceMs ?? TURN_COMPLETED_DEBOUNCE_MS;
  const now = options.now ?? Date.now;
  const scheduler = options.scheduler ?? defaultScheduler;

  const pending = new Map<string, PendingPermission>();
  const lastFailurePost = new Map<string, number>();
  const lastCompletedPost = new Map<string, number>();
  let disposed = false;

  return {
    permissionBefore({ agent, request }, signal) {
      if (disposed || pending.has(request.id)) {
        return;
      }
      const entry: PendingPermission = { agent, request, signal, timer: 0 };
      entry.timer = scheduler.setTimeout(() => {
        if (!pending.delete(request.id)) {
          return;
        }
        void options.post(
          buildPermissionPendingPayload(
            { agent, request },
            new Date(now()).toISOString(),
          ),
          entry.signal,
        );
      }, debounceMs);
      pending.set(request.id, entry);
    },

    permissionAfter(requestId) {
      const entry = pending.get(requestId);
      if (!entry) {
        return;
      }
      scheduler.clearTimeout(entry.timer);
      pending.delete(requestId);
    },

    turnAfter({ agent, outcome }, signal) {
      if (disposed || outcome.kind === "canceled") {
        return;
      }
      const t = now();
      if (outcome.kind === "completed") {
        // Every completed turn may wake the bot; the short window only
        // collapses bursty double turn_ended emissions for the same agent.
        const last = lastCompletedPost.get(agent.id);
        if (last !== undefined && t - last < completedDebounceMs) {
          return;
        }
        lastCompletedPost.set(agent.id, t);
        void options.post(
          buildTurnCompletedPayload(
            { agent, turnId: null, outcome },
            new Date(t).toISOString(),
          ),
          signal,
        );
        return;
      }
      const last = lastFailurePost.get(agent.id);
      if (last !== undefined && t - last < cooldownMs) {
        return;
      }
      lastFailurePost.set(agent.id, t);
      void options.post(
        buildTurnFailedPayload(
          { agent, turnId: null, outcome },
          new Date(t).toISOString(),
        ),
        signal,
      );
    },

    agentGone(agentId) {
      for (const [id, entry] of pending) {
        if (entry.agent.id === agentId) {
          scheduler.clearTimeout(entry.timer);
          pending.delete(id);
        }
      }
      lastFailurePost.delete(agentId);
      lastCompletedPost.delete(agentId);
    },

    dispose() {
      disposed = true;
      for (const entry of pending.values()) {
        scheduler.clearTimeout(entry.timer);
      }
      pending.clear();
      lastFailurePost.clear();
      lastCompletedPost.clear();
    },
  };
}
