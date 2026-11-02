import { describe, expect, it, vi } from "vitest";
import { createWebhookPoster } from "./poster";
import type { WakePayload } from "./payload";

const URL_VALUE = "https://hooks.example.com/secret/path?token=abc";
const KEY = "secret-key";

const payload: WakePayload = {
  v: 1,
  ts: "2026-11-03T12:00:00.000Z",
  event: "agent.turn.after",
  agentId: "a1",
  outcome: "failed",
};

function setup(fetchImpl: ReturnType<typeof vi.fn>) {
  const warnings: string[] = [];
  const post = createWebhookPoster({
    url: URL_VALUE,
    key: KEY,
    host: "hooks.example.com",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    warn: (m) => warnings.push(m),
  });
  return { post, warnings };
}

describe("createWebhookPoster", () => {
  it("POSTs JSON with a bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const { post, warnings } = setup(fetchImpl);
    await post(payload);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(URL_VALUE);
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(init.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual(payload);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(warnings).toEqual([]);
  });

  it("warns on non-2xx without throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const { post, warnings } = setup(fetchImpl);
    await expect(post(payload)).resolves.toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("500");
    expect(warnings[0]).not.toContain(KEY);
    expect(warnings[0]).not.toContain("/secret/path");
  });

  it("warns on rejection without throwing", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error(`connect failed ${URL_VALUE}`));
    const { post, warnings } = setup(fetchImpl);
    await expect(post(payload)).resolves.toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).not.toContain(KEY);
    expect(warnings[0]).not.toContain(URL_VALUE);
    expect(warnings[0]).toContain("hooks.example.com");
  });

  it("combines the context signal with the timeout", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const { post } = setup(fetchImpl);
    const controller = new AbortController();
    await post(payload, controller.signal);
    const signal = fetchImpl.mock.calls[0]![1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });
});
