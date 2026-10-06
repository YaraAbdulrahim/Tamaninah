/**
 * Vite config for the e2e web server: the project's own config with file watching off.
 *
 * vite.config.ts imports the API plugin (server/**), so with watching on, any edit under server/
 * or src/ during a run restarts the dev server or full-reloads every open page — tests then fail
 * with ERR_CONNECTION_REFUSED or a page that navigates under them. A test server must not do that.
 */
import type { ConfigEnv, UserConfig } from "vite";
import projectConfig from "../vite.config";

export default (env: ConfigEnv): UserConfig => {
  const resolved = (typeof projectConfig === "function" ? projectConfig(env) : projectConfig) as UserConfig;
  return { ...resolved, server: { ...resolved.server, watch: null, hmr: false } };
};
