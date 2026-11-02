import type { PluginHookAgent } from "@getpaseo/plugin/server";
import type { AgentPermissionRequest } from "@getpaseo/protocol/agent-types";
import type {
  AgentPermissionBeforeEvent,
  AgentTurnAfterEvent,
} from "./hooks";

export const PAYLOAD_VERSION = 1;

interface WakePayloadBase {
  v: typeof PAYLOAD_VERSION;
  ts: string;
  agentId: string;
  title?: string;
}

export interface PermissionPendingPayload extends WakePayloadBase {
  event: "agent.permission.before";
  kind: AgentPermissionRequest["kind"];
  tool?: string;
}

export interface TurnFailedPayload extends WakePayloadBase {
  event: "agent.turn.after";
  outcome: "failed";
  errorCode?: string;
}

export type WakePayload = PermissionPendingPayload | TurnFailedPayload;

function agentFields(agent: PluginHookAgent, ts: string): WakePayloadBase {
  return {
    v: PAYLOAD_VERSION,
    ts,
    agentId: agent.id,
    ...(agent.title ? { title: agent.title } : {}),
  };
}

export function buildPermissionPendingPayload(
  event: AgentPermissionBeforeEvent,
  ts: string,
): PermissionPendingPayload {
  const { agent, request } = event;
  return {
    ...agentFields(agent, ts),
    event: "agent.permission.before",
    kind: request.kind,
    ...(request.kind === "tool" && request.name
      ? { tool: request.name }
      : {}),
  };
}

export function buildTurnFailedPayload(
  event: AgentTurnAfterEvent,
  ts: string,
): TurnFailedPayload {
  const { agent, outcome } = event;
  return {
    ...agentFields(agent, ts),
    event: "agent.turn.after",
    outcome: "failed",
    ...(outcome.kind === "failed" && outcome.error.code
      ? { errorCode: outcome.error.code }
      : {}),
  };
}
