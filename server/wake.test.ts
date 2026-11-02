import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginHookAgent } from "@getpaseo/plugin/server";
import type { AgentPermissionRequest } from "@getpaseo/protocol/agent-types";
import type { WakePayload } from "./payload";
import {
  createWakeFilter,
  PERMISSION_DEBOUNCE_MS,
  TURN_FAILURE_COOLDOWN_MS,
} from "./wake";

function agent(id: string): PluginHookAgent {
  return {
    id,
    workspaceId: "ws-1",
    parentAgentId: null,
    provider: "claude",
    cwd: "/tmp",
    title: null,
  };
}

function request(id: string): AgentPermissionRequest {
  return { id, provider: "claude", name: "bash", kind: "tool" };
}

function setup() {
  const post = vi.fn<(payload: WakePayload) => Promise<void>>()
    .mockResolvedValue(undefined);
  const filter = createWakeFilter({ post });
  return { post, filter };
}

describe("permission debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("posts once the debounce elapses and the request is still pending", () => {
    const { post, filter } = setup();
    filter.permissionBefore({ agent: agent("a1"), request: request("r1") });
    expect(post).not.toHaveBeenCalled();
    vi.advanceTimersByTime(PERMISSION_DEBOUNCE_MS - 1);
    expect(post).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]![0]).toMatchObject({
      event: "agent.permission.before",
      agentId: "a1",
      kind: "tool",
      tool: "bash",
    });
  });

  it("dedupes repeats of the same request id", () => {
    const { post, filter } = setup();
    const event = { agent: agent("a1"), request: request("r1") };
    filter.permissionBefore(event);
    filter.permissionBefore(event);
    vi.advanceTimersByTime(PERMISSION_DEBOUNCE_MS);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("cancels the post when permission.after resolves first", () => {
    const { post, filter } = setup();
    filter.permissionBefore({ agent: agent("a1"), request: request("r1") });
    vi.advanceTimersByTime(PERMISSION_DEBOUNCE_MS / 2);
    filter.permissionAfter("r1");
    vi.advanceTimersByTime(PERMISSION_DEBOUNCE_MS * 2);
    expect(post).not.toHaveBeenCalled();
  });

  it("ignores permission.after for unknown requests", () => {
    const { filter } = setup();
    expect(() => filter.permissionAfter("nope")).not.toThrow();
  });

  it("posts every kind of permission request", () => {
    const { post, filter } = setup();
    for (const kind of ["tool", "plan", "question", "mode", "other"] as const) {
      filter.permissionBefore({
        agent: agent("a1"),
        request: { ...request(`r-${kind}`), kind },
      });
    }
    vi.advanceTimersByTime(PERMISSION_DEBOUNCE_MS);
    expect(post).toHaveBeenCalledTimes(5);
  });
});

describe("turn failure cooldown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("posts on failed outcome only", () => {
    const { post, filter } = setup();
    const a = agent("a1");
    filter.turnAfter({ agent: a, outcome: { kind: "completed" } });
    filter.turnAfter({ agent: a, outcome: { kind: "canceled", reason: "user" } });
    expect(post).not.toHaveBeenCalled();
    filter.turnAfter({
      agent: a,
      outcome: { kind: "failed", error: { message: "boom" } },
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]![0]).toMatchObject({
      event: "agent.turn.after",
      outcome: "failed",
      agentId: "a1",
    });
  });

  it("suppresses repeat failures inside the cooldown window, per agent", () => {
    const { post, filter } = setup();
    const outcome = {
      kind: "failed",
      error: { message: "boom" },
    } as const;
    filter.turnAfter({ agent: agent("a1"), outcome });
    filter.turnAfter({ agent: agent("a1"), outcome });
    expect(post).toHaveBeenCalledTimes(1);
    filter.turnAfter({ agent: agent("a2"), outcome });
    expect(post).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(TURN_FAILURE_COOLDOWN_MS);
    filter.turnAfter({ agent: agent("a1"), outcome });
    expect(post).toHaveBeenCalledTimes(3);
  });
});

describe("agentGone", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("clears pending permissions for that agent only", () => {
    const { post, filter } = setup();
    filter.permissionBefore({ agent: agent("a1"), request: request("r1") });
    filter.permissionBefore({ agent: agent("a2"), request: request("r2") });
    filter.agentGone("a1");
    vi.advanceTimersByTime(PERMISSION_DEBOUNCE_MS);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]![0]).toMatchObject({ agentId: "a2" });
  });

  it("resets the failure cooldown for that agent", () => {
    const { post, filter } = setup();
    const outcome = {
      kind: "failed",
      error: { message: "boom" },
    } as const;
    filter.turnAfter({ agent: agent("a1"), outcome });
    filter.agentGone("a1");
    filter.turnAfter({ agent: agent("a1"), outcome });
    expect(post).toHaveBeenCalledTimes(2);
  });
});
