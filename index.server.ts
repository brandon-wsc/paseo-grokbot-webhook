import type { PluginServerContext } from "@getpaseo/plugin/server";
import { loadConfig, readWebhookEnvFile } from "./server/config";
import { createWebhookPoster } from "./server/poster";
import { createWakeFilter } from "./server/wake";

export default function contribute(server: PluginServerContext) {
  const config = loadConfig(process.env, undefined, readWebhookEnvFile());
  if (!config) {
    return () => {};
  }

  const post = createWebhookPoster(config);
  const filter = createWakeFilter({ post });

  // Paseo 0.14 exposes server.on / server.before. addHook lands in 0.15;
  // map to the documented renames (see paseo.sh/docs/plugins/hooks).
  const removers = [
    server.on("agent.permission_requested", async (event, context) => {
      filter.permissionBefore(event, context.signal);
    }),
    server.on("agent.permission_resolved", async (event) => {
      filter.permissionAfter(event.requestId);
    }),
    server.on("agent.turn_ended", async (event, context) => {
      filter.turnAfter(event, context.signal);
    }),
    server.on("agent.closed", async (event) => {
      filter.agentGone(event.agent.id);
    }),
    server.on("agent.archived", async (event) => {
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
