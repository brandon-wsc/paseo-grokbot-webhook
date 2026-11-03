import type { Warn } from "./config";
import type { WakePayload } from "./payload";

export const FETCH_TIMEOUT_MS = 10_000;

export interface PosterOptions {
  url: string;
  key: string;
  host: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  warn?: Warn;
}

/** Fire-and-forget: resolves after delivery attempt; never rejects. */
export type WebhookPoster = (
  payload: WakePayload,
  contextSignal?: AbortSignal,
) => Promise<void>;

export function createWebhookPoster(options: PosterOptions): WebhookPoster {
  const { url, key, host } = options;
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const warn = options.warn ?? ((message) => console.warn(message));

  return async (payload, contextSignal) => {
    try {
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal =
        contextSignal && typeof AbortSignal.any === "function"
          ? AbortSignal.any([contextSignal, timeout])
          : timeout;
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(payload),
        signal,
      });
      if (!response.ok) {
        warn(
          `[paseo-grokbot-webhook] webhook POST to ${host} failed: HTTP ${response.status}`,
        );
      }
    } catch (error) {
      warn(
        `[paseo-grokbot-webhook] webhook POST to ${host} failed: ${describe(error, url)}`,
      );
    }
  };
}

function describe(error: unknown, url: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split(url).join("<webhook-url>");
}
