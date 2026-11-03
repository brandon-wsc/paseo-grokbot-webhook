# paseo-grokbot-webhook

A thin [Paseo](https://paseo.sh) plugin that POSTs selected Paseo agent
lifecycle events to a Grok Bot routine webhook — so Dev (or related bots)
can be woken up when a Paseo agent needs follow-up, instead of a human
having to watch the terminal.

> **Status: implemented.** Server-only plugin; no client UI. Verified with
> `npm run typecheck` and `npm test`. Not yet installed against a live
> Paseo daemon.

Working on this repo? Read [`AGENTS.md`](AGENTS.md) — the agent brief and
commit/branch/PR conventions live there.

## Why this exists

Paseo emits terminal/activity lifecycle events, and Grok Bot supports
webhook-triggered routines — but there is no stock bridge between them.
Paseo ≥ 0.14 exposes plugin hooks (`server.addHook`) where a plugin can
`fetch` a POST out to an arbitrary URL. This repo is that bridge: hook in,
filter for the events that mean "a human or bot should look at this", and
poke a Grok Bot webhook routine that babysits the agent on wake.

## Layout

- `index.server.ts` — plugin entry point (server-side only, Paseo ≥ 0.14)
- `server/` — daemon-side modules:
  - `config.ts` — env parsing; the plugin stays inert and registers no
    hooks unless both env vars are set
  - `hooks.ts` — the `addHook` surface this plugin uses (typed locally;
    `addHook` runs on Paseo ≥ 0.14 but its typings shipped after the
    `@getpaseo/plugin` 0.14 npm release)
  - `wake.ts` — the wake filter: debounce, dedupe, and cooldown state
  - `payload.ts` — the small JSON body sent on wake
  - `poster.ts` — the fire-and-forget POST
- `server/*.test.ts` — vitest unit tests for the pure logic

## Configuration

Environment only; there are no plugin settings:

- `GROK_WEBHOOK_URL` — the Grok Bot routine webhook endpoint (http/https).
  Required.
- `GROK_WEBHOOK_KEY` — sent as `Authorization: Bearer <key>`. Required.

If either is missing or the URL is invalid, the plugin logs one warning
showing only the URL host and registers no hooks. The key and the full URL
are never logged.

## What wakes Grok Bot

| Paseo hook | Behavior |
|------------|----------|
| `agent.permission.before` | Debounce 10s (deduped by `request.id`); if the request is still pending when the timer fires, POST a wake. Every permission kind (`tool`, `plan`, `question`, `mode`, `other`) counts. |
| `agent.permission.after` | Cancels the pending debounce — a resolved request never wakes the bot. |
| `agent.turn.after` | POST only when `outcome.kind === "failed"`, with a 10-minute cooldown per agent. `completed` and `canceled` never wake the bot. |
| `agent.close.after`, `agent.archive.after` | Clear the agent's pending debounces and cooldown state; never POST. |

## Payload

A small JSON body, versioned:

```json
{
  "v": 1,
  "event": "agent.permission.before",
  "ts": "2026-11-03T12:00:00.000Z",
  "agentId": "agent-1",
  "title": "Fix flaky test",
  "kind": "tool",
  "tool": "bash"
}
```

- `event` — the hook that fired (`agent.permission.before` = pending
  permission, `agent.turn.after` = failed turn)
- `agentId`, `title?` — which Paseo agent wants attention
- `kind` + `tool?` — permission kind, and the tool name for `tool`
  requests
- `outcome` + `errorCode?` — on turn failure (`outcome` is always
  `"failed"`)

Deliberately absent: raw tool arguments, `cwd`, error message text, env —
nothing that could carry secrets or local paths.

## Delivery

Fire-and-forget. The POST carries `Authorization: Bearer $GROK_WEBHOOK_KEY`,
a JSON body, and a ~10s fetch timeout combined with the hook's abort signal
via `AbortSignal.any` when available. A non-2xx response or a fetch failure
logs a warning; it is never retried and never thrown back into the Paseo
agent loop.

## Install

1. `npm install && npm run typecheck` in this directory.
2. `paseo plugin install /absolute/path/to/paseo-grokbot-webhook`
   (or paste the path into **Settings → Plugins → Plugin source**).
3. Set `GROK_WEBHOOK_URL` and `GROK_WEBHOOK_KEY` either in the daemon
   process environment **or** in `$PASEO_HOME/webhook.env` (same `KEY=value`
   lines; mode `0600`), then `paseo plugin reload paseo-grokbot-webhook`.
4. Against Paseo **0.14**, hooks register via `server.on` / `server.before`
   (the docs' `addHook` names land in 0.15).
4. On the Grok Bot side, create a webhook routine whose job is to babysit
   the agent on wake (check status, nudge, approve permissions, etc.).

## Development

- `npm run typecheck` — `tsc --noEmit` (strict)
- `npm test` — vitest unit tests for the filter, payload, poster, and env
  parsing
- `package.json` declares `engines.node >=26` to match the daemon, but the
  code only uses APIs that also exist on Node 20 (`fetch`,
  `AbortSignal.timeout`, `AbortSignal.any`)

## Non-goals

- Not a scheduled poller — events are pushed from hooks, not pulled on a
  timer.
- Not an MCP bridge — this is one-directional fire-and-forget webhook
  delivery.
- Not a substitute for the Paseo↔Grok crosswalk docs — it only covers the
  "Paseo wants attention" direction.

## References

- Paseo plugin hooks: https://paseo.sh/docs/plugins/hooks
- Paseo plugin reference: https://paseo.sh/docs/plugins/reference
- Grok Bot routines / webhooks: see the Cursor "Grok Bot routines" webhook
  documentation.

## License

[MIT](LICENSE) — copyright 2026 Brandon Wong (brandon-wsc).
