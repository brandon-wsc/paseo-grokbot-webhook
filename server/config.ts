import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface WebhookConfig {
  url: string;
  key: string;
  host: string;
}

export type Warn = (message: string) => void;

const defaultWarn: Warn = (message) => console.warn(message);

/** Optional durable file: `$PASEO_HOME/webhook.env` (KEY=value lines). */
export function readWebhookEnvFile(
  home = process.env.PASEO_HOME?.trim() || join(homedir(), ".paseo"),
): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  let raw: string;
  try {
    raw = readFileSync(join(home, "webhook.env"), "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (name === "GROK_WEBHOOK_URL" || name === "GROK_WEBHOOK_KEY") {
      out[name] = value;
    }
  }
  return out;
}

export function loadConfig(
  env: NodeJS.ProcessEnv,
  warn: Warn = defaultWarn,
  fileEnv: NodeJS.ProcessEnv = {},
): WebhookConfig | null {
  const url = (env.GROK_WEBHOOK_URL ?? fileEnv.GROK_WEBHOOK_URL)?.trim();
  const key = (env.GROK_WEBHOOK_KEY ?? fileEnv.GROK_WEBHOOK_KEY)?.trim();

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
