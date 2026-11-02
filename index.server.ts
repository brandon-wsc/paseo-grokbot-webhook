import type { PluginServerContext } from "@getpaseo/plugin/server";
import { loadConfig } from "./server/config";
import type { PluginHookServer } from "./server/hooks";
import { createWebhookPoster } from "./server/poster";
import { createWakeFilter } from "./server/wake";

export default function contribute(server: PluginServerContext) {
  const config = loadConfig(process.env);
  if (!config) {
    return () => {};
  }

  const post = createWebhookPoster(config);
  const filter = createWakeFilter({ post });
  // `addHook` ships in the Paseo 0.14 runtime but its typings landed after the
  // @getpaseo/plugin 0.14 npm release; PluginHookServer mirrors the documented
  // surface (see server/hooks.ts).
  const hooks = server as unknown as PluginHookServer;

  const removers = [
    hooks.addHook("agent.permission.before", async (event, context) => {
      filter.permissionBefore(event, context.signal);
    }),
    hooks.addHook("agent.permission.after", async (event) => {
      filter.permissionAfter(event.requestId);
    }),
    hooks.addHook("agent.turn.after", async (event, context) => {
      filter.turnAfter(event, context.signal);
    }),
    hooks.addHook("agent.close.after", async (event) => {
      filter.agentGone(event.agent.id);
    }),
    hooks.addHook("agent.archive.after", async (event) => {
      filter.agentGone(event.agent.id);
    }),
  ];

  return () => {
    for (const remove of removers) {
      remove();
    }
    filter.dispose();
  };
}
