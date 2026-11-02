export interface WebhookConfig {
  url: string;
  key: string;
  host: string;
}

export type Warn = (message: string) => void;

const defaultWarn: Warn = (message) => console.warn(message);

export function loadConfig(
  env: NodeJS.ProcessEnv,
  warn: Warn = defaultWarn,
): WebhookConfig | null {
  const url = env.GROK_WEBHOOK_URL?.trim();
  const key = env.GROK_WEBHOOK_KEY?.trim();

  let host = "unset";
  if (url) {
    try {
      host = new URL(url).host || "unparseable";
    } catch {
      host = "unparseable";
    }
  }

  if (!url || !key) {
    warn(
      `[paseo-grokbot-webhook] inert: GROK_WEBHOOK_URL and GROK_WEBHOOK_KEY are both required (host: ${host})`,
    );
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("unsupported protocol");
    }
    return { url, key, host: parsed.host };
  } catch {
    warn(
      `[paseo-grokbot-webhook] inert: GROK_WEBHOOK_URL is not a valid http(s) URL (host: ${host})`,
    );
    return null;
  }
}
