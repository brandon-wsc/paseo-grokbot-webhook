import { describe, expect, it } from "vitest";
import type { PluginHookAgent } from "@getpaseo/plugin/server";
import type { AgentPermissionRequest } from "@getpaseo/protocol/agent-types";
import {
  buildPermissionPendingPayload,
  buildTurnFailedPayload,
} from "./payload";

const agent: PluginHookAgent = {
  id: "agent-1",
  workspaceId: "ws-1",
  parentAgentId: null,
  provider: "claude",
  cwd: "/home/user/secret-project",
  title: "Fix flaky test",
};

const TS = "2026-11-03T12:00:00.000Z";

function request(overrides: Partial<AgentPermissionRequest> = {}) {
  const base: AgentPermissionRequest = {
    id: "req-1",
    provider: "claude",
    name: "bash",
    kind: "tool",
    input: { command: "rm -rf /", cwd: "/home/user/secret-project" },
  };
  return { ...base, ...overrides };
}

describe("buildPermissionPendingPayload", () => {
  it("carries ids, kind, and tool name only", () => {
    const payload = buildPermissionPendingPayload(
      { agent, request: request() },
      TS,
    );
    expect(payload).toEqual({
      v: 1,
      ts: TS,
      event: "agent.permission.before",
      agentId: "agent-1",
      title: "Fix flaky test",
      kind: "tool",
      tool: "bash",
    });
  });

  it("omits tool for non-tool kinds and never leaks input or cwd", () => {
    const payload = buildPermissionPendingPayload(
      { agent, request: request({ kind: "question", name: "ask" }) },
      TS,
    );
    expect(payload).not.toHaveProperty("tool");
    expect(JSON.stringify(payload)).not.toContain("rm -rf");
    expect(JSON.stringify(payload)).not.toContain("/home/user/secret-project");
  });
});

describe("buildTurnFailedPayload", () => {
  it("reports the failed outcome with optional error code", () => {
    const payload = buildTurnFailedPayload(
      {
        agent,
        turnId: "t-1",
        outcome: {
          kind: "failed",
          error: { message: "boom", code: "rate_limit" },
        },
      },
      TS,
    );
    expect(payload).toEqual({
      v: 1,
      ts: TS,
      event: "agent.turn.after",
      agentId: "agent-1",
      title: "Fix flaky test",
      outcome: "failed",
      errorCode: "rate_limit",
    });
    expect(JSON.stringify(payload)).not.toContain("boom");
  });
});
