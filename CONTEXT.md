# Context — paseo-grokbot-webhook

Glossary for humans and agents. Terms only — product intent lives in [`README.md`](README.md), implementation in code.

- **Paseo** — the terminal/agent orchestration app that runs coding agents and emits lifecycle events. The plugin targets Paseo ≥ 0.14.
- **Plugin hook** — a named lifecycle callback a Paseo plugin registers via `server.addHook` (e.g. `agent.permission.after`, `agent.turn.after`). Server-side plugins live in `index.server.ts`.
- **Lifecycle event** — a state change in a Paseo agent's run (permission requested, turn finished, agent failed, …) that a hook observes.
- **Grok Bot routine** — a job in Grok Bot (Dev) that can be woken by a webhook POST instead of a schedule; on wake it babysits the flagged agent.
- **Webhook wake** — the single outbound `POST` this plugin sends to `GROK_WEBHOOK_URL` when a filtered event fires, with `Authorization: Bearer $GROK_WEBHOOK_KEY`.
- **`GROK_WEBHOOK_URL`** — env var: the Grok Bot routine's webhook endpoint. Required.
- **`GROK_WEBHOOK_KEY`** — env var: bearer token sent with the POST. Required. Never logged or committed.
- **Payload** — the JSON body of the wake POST: `v`, `event`, `ts`, `agentId`, optional `title`, plus `kind`/`tool` for permission wakes or `outcome` (`completed`/`failed`) and `errorCode` for turn ends. Never raw tool args, `cwd`, or env.
- **Fire-and-forget** — send and move on: delivery failures are logged, never retried, never thrown back into the agent loop.
