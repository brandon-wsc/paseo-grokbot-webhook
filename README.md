# paseo-grokbot-webhook

A thin [Paseo](https://paseo.sh) plugin that POSTs selected Paseo agent
lifecycle events to a Grok Bot routine webhook — so Dev (or related bots)
can be woken up when a Paseo agent needs follow-up, instead of a human
having to watch the terminal.

> **Status: scaffold / design first.** This commit contains only the README
> and MIT license. No plugin code has landed yet.

## Why this exists

Paseo emits terminal/activity lifecycle events, and Grok Bot supports
webhook-triggered routines — but there is no stock bridge between them.
Paseo ≥ 0.14 exposes plugin hooks (`server.addHook`) where a plugin can
`fetch` a POST out to an arbitrary URL. This repo is that bridge: hook in,
filter for the events that mean "a human or bot should look at this", and
poke a Grok Bot webhook routine that babysits the agent on wake.

## Target stack

- Paseo plugin entry point: `index.server.ts` (server-side plugin, Paseo ≥ 0.14)
- Configuration via environment variables:
  - `GROK_WEBHOOK_URL` — the Grok Bot routine webhook endpoint
  - `GROK_WEBHOOK_KEY` — sent as `Authorization: Bearer <key>`
- Payload: JSON body containing the Paseo agent id/name, the lifecycle
  event, and an outcome/permission summary

## Suggested first hooks

- `agent.permission.after` — or `.before`, when a permission request is
  left pending and needs someone to approve/deny
- `agent.turn.after` — filtered to outcomes like `needs-input`, `failed`,
  or idle-after-block

Exact hook names and payload shapes will be confirmed against the Paseo
hooks docs before implementation.

## Install sketch

Not a real package yet. Once published:

1. Enable the plugin in your Paseo config.
2. Set `GROK_WEBHOOK_URL` and `GROK_WEBHOOK_KEY` in the environment Paseo
   runs under.
3. On the Grok Bot side, create a webhook routine whose job is to babysit
   the agent on wake (check status, nudge, approve permissions, etc.).

## Non-goals

- Not a scheduled poller — events are pushed from hooks, not pulled on a
  timer.
- Not an MCP bridge — this is one-directional fire-and-forget webhook
  delivery.
- Not a substitute for the Paseo↔Grok crosswalk docs — it only covers the
  "Paseo wants attention" direction.

## References

- Paseo plugin hooks: https://paseo.sh/docs/plugins/hooks
- Grok Bot routines / webhooks: see the Cursor "Grok Bot routines" webhook
  documentation.

## License

[MIT](LICENSE) — copyright 2026 Brandon Wong (brandon-wsc).
