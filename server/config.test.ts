import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "./config";

const URL_VALUE = "https://hooks.example.com/secret/path?token=abc";
const KEY_VALUE = "super-secret-key";

function warns() {
  const calls: string[] = [];
  return {
    calls,
    warn: vi.fn((message: string) => calls.push(message)),
  };
}

describe("loadConfig", () => {
  it("returns config and host when both env vars are set", () => {
    const { warn } = warns();
    const config = loadConfig(
      { GROK_WEBHOOK_URL: URL_VALUE, GROK_WEBHOOK_KEY: KEY_VALUE },
      warn,
    );
    expect(config).toEqual({
      url: URL_VALUE,
      key: KEY_VALUE,
      host: "hooks.example.com",
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("is inert when the URL is missing", () => {
    const { warn, calls } = warns();
    expect(loadConfig({ GROK_WEBHOOK_KEY: KEY_VALUE }, warn)).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("host: unset");
  });

  it("is inert when the key is missing, warning with host only", () => {
    const { warn, calls } = warns();
    expect(loadConfig({ GROK_WEBHOOK_URL: URL_VALUE }, warn)).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("hooks.example.com");
    expect(calls[0]).not.toContain(URL_VALUE);
  });

  it("is inert when the URL is unparseable", () => {
    const { warn, calls } = warns();
    expect(
      loadConfig(
        { GROK_WEBHOOK_URL: "not a url", GROK_WEBHOOK_KEY: KEY_VALUE },
        warn,
      ),
    ).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toContain(KEY_VALUE);
    expect(calls[0]).not.toContain("not a url");
  });

  it("rejects non-http(s) URLs", () => {
    const { warn } = warns();
    expect(
      loadConfig(
        { GROK_WEBHOOK_URL: "ftp://hooks.example.com/x", GROK_WEBHOOK_KEY: KEY_VALUE },
        warn,
      ),
    ).toBeNull();
  });

  it("never logs the key or the full URL", () => {
    const { warn, calls } = warns();
    loadConfig({ GROK_WEBHOOK_URL: URL_VALUE }, warn);
    loadConfig(
      { GROK_WEBHOOK_URL: "::::", GROK_WEBHOOK_KEY: KEY_VALUE },
      warn,
    );
    for (const message of calls) {
      expect(message).not.toContain(KEY_VALUE);
      expect(message).not.toContain("/secret/path");
      expect(message).not.toContain("token=abc");
    }
  });
});
