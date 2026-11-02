import type {
  PluginHookAgent,
  PluginHookContext,
  PluginTurnOutcome,
} from "@getpaseo/plugin/server";
import type {
  AgentPermissionRequest,
  AgentPermissionResponse,
} from "@getpaseo/protocol/agent-types";

// `server.addHook` with `subject.operation.position` hook names is available
// from Paseo 0.14 per https://paseo.sh/docs/plugins/hooks, but its typings only
// shipped in @getpaseo/plugin 0.15. Mirror the documented surface here so the
// pinned 0.14 devDependency still typechecks.

export interface AgentPermissionBeforeEvent {
  agent: PluginHookAgent;
  request: AgentPermissionRequest;
}

export interface AgentPermissionAfterEvent {
  agent: PluginHookAgent;
  requestId: string;
  resolution: AgentPermissionResponse;
}

export interface AgentTurnAfterEvent {
  agent: PluginHookAgent;
  turnId: string | null;
  outcome: PluginTurnOutcome;
}

export interface AgentLifecycleEvent {
  agent: PluginHookAgent;
}

type NotificationHandler<Event> = (
  event: Event,
  context: PluginHookContext,
) => Promise<void>;

export interface PluginHookServer {
  addHook(
    name: "agent.permission.before",
    handler: NotificationHandler<AgentPermissionBeforeEvent>,
  ): () => void;
  addHook(
    name: "agent.permission.after",
    handler: NotificationHandler<AgentPermissionAfterEvent>,
  ): () => void;
  addHook(
    name: "agent.turn.after",
    handler: NotificationHandler<AgentTurnAfterEvent>,
  ): () => void;
  addHook(
    name: "agent.close.after" | "agent.archive.after",
    handler: NotificationHandler<AgentLifecycleEvent>,
  ): () => void;
}
