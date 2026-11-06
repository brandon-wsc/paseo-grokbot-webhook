# Agent brief — paseo-grokbot-webhook

Short map for coding agents. Prefer these sources over inventing parallel docs or shapes.

Execution conventions (commits, branches, pull requests) live **in this file**. Do not keep a second copy in harness-specific packs (`.cursor/rules`, `CLAUDE.md`, and similar). A tool may *point* here; it must not own the rules.

## What this is

A thin [Paseo](https://paseo.sh) plugin that POSTs selected Paseo agent lifecycle events to a Grok Bot routine webhook — so Dev (or related bots) wakes when a Paseo agent needs follow-up instead of a human watching the terminal. One direction, fire-and-forget. Implemented and running live on the Grok Bot box Paseo daemon.

## Single sources of truth

| Concern | Authority | Notes |
|---------|-----------|-------|
| Product intent | [`README.md`](README.md) | Why the bridge exists, target stack, non-goals. Update it when intent changes |
| Domain language | [`CONTEXT.md`](CONTEXT.md) | Glossary only — no implementation |
| Agent execution | this file | Commits, branches, PRs |

## Hard boundaries

1. **Fire-and-forget POST only** — a hook fires, a filtered JSON payload is POSTed to `GROK_WEBHOOK_URL`, and the plugin moves on. A delivery failure logs a warning; it never throws back into the Paseo agent loop and never retries forever.
2. **No poller** — events are pushed from hooks, never pulled on a timer. A missed event is missed.
3. **One direction** — Paseo → Grok Bot. The plugin exposes no endpoint and takes no commands back; the Grok Bot routine decides what to do on wake.
4. **Env config is required** — `GROK_WEBHOOK_URL` and `GROK_WEBHOOK_KEY` must both be set or the plugin stays inert. No defaults that silently POST somewhere.
5. **No secrets in logs or commits** — never print the bearer key or the full webhook URL at info level; never commit `.env` files or real endpoints.
6. **Wake is a hint for the consumer** — this plugin does not retry or persist dedupe across daemon restarts. The Grok Bot routine must re-read Paseo state, lease by task id in the agent title, and append failed turns to `attempts.jsonl`. See README → Consumer contract.

## Working agreements

- **Confirm hooks against Paseo docs first.** Exact hook names and payload shapes (`agent.permission.after`, `agent.turn.after`, …) come from the Paseo plugin-hooks docs (see README → References). Verify before writing the filter; do not guess from memory.
- **Fail quiet.** A webhook failure must not block, delay, or crash the lifecycle event it rode in on.
- **Design before code.** Behavior decisions land in the README before implementation, not in commit messages or chat.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
type(scope): summary

optional body explaining why
```

- `type` — required; see table below
- `scope` — required; short area (`plugin`, `webhook`, `hooks`, `docs`, `ci`, `repo`, …)
- `summary` — imperative, lowercase after the colon, ≤72 chars total subject line, no trailing period
- `body` — optional; explain **why**, not a file list. Use bullets for multi-part milestones

```text
✅ feat(plugin): forward agent.turn.after events to grok webhook
✅ docs(repo): add agent brief and context glossary

❌ Add the plugin entry point                 # missing type(scope)
❌ feat: add stuff                            # missing scope; vague summary
❌ feat(plugin): Added webhook POST.          # past tense + trailing period
```

| Type | When |
|------|------|
| `feat` | New user-facing capability |
| `fix` | Bug fix |
| `refactor` | Behavior-preserving code change |
| `docs` | Docs only |
| `chore` | Tooling, deps, ignore files, misc |
| `test` | Tests only |
| `ci` | CI/CD config |
| `perf` | Performance improvement |

Prefer domain names for `scope`: `plugin`, `webhook`, `hooks`, `docs`, `ci`, `repo`. Prefer why over what. Never put secrets or env values in messages. Keep the **subject line ASCII-only** — put non-ASCII detail in the body if needed.

## Branch names

Follow the [Conventional Branch](https://conventionalbranch.org/) purpose prefixes: `feat/…` (or `feature/…`), `fix/…` (or `bugfix/…`), `hotfix/…`, `release/…` (dots OK for versions, e.g. `release/v0.1.0`), `chore/…`. Slug is lowercase, hyphen-separated — e.g. `feat/webhook-filter`. There is no `ci/`, `docs/`, `test/`, `refactor/`, or `perf/` branch — branch type is work intent, not commit type: CI-config, docs, refactor, and test-only work all branch under `chore/…` (their commits still use the commit-type table above).

## Pull requests

- **Title** — same format as commit subjects (`type(scope): summary`, ≤72 chars, ASCII-only); use the dominant change's type/scope. The `conventions` job in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) rejects a PR whose branch, title, or commit subjects do not match.
- **Body** — follow `.github/pull_request_template.md`: `## Summary` (what + why) and `#### Test plan`. CI does not read the body.
- **Merge method** — merge commit only, once branch protection exists: commit subjects land on `main` individually; the PR title does not.

## Feature work

- **Do not commit to, merge into, or push `main`.** Work on a feature branch. The repo owner updates `main` and handles PRs.
- **New feature / fix → fresh branch off latest `main`.** Never reuse a merged or unrelated branch — one branch + PR per change.

## When reviewing changes

- Flag a scheduled poller, a retry loop, or any pull-based delivery.
- Flag a code path that can throw back into Paseo's agent loop or block a lifecycle event.
- Flag secrets, real webhook URLs, or `.env` material in logs, tests, or commits.
- Flag a second direction — the plugin listens and POSTs; it does not serve requests.
