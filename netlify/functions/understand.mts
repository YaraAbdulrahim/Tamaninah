/**
 * Netlify Function for POST /api/understand (modern Request/Response API).
 *
 * Secrets come from the Netlify UI/CLI (scope must include Functions): AI_API_KEY, AI_BASE_URL,
 * AI_MODEL (comma-separated fallback list), optional AI_REASONING_EFFORT, AI_HEDGE_AFTER_MS,
 * AI_DEADLINE_MS. Variables set in netlify.toml are NOT visible here.
 */
import type { Config, Context } from "@netlify/functions";

import { handleUnderstand, type UnderstandEnv } from "../../server/http/understand";

const ENV_KEYS = [
  "AI_API_KEY",
  "AI_BASE_URL",
  "AI_MODEL",
  "AI_REASONING_EFFORT",
  "AI_HEDGE_AFTER_MS",
  "AI_DEADLINE_MS",
  "AI_MOCK",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
] as const;

function readEnv(): UnderstandEnv {
  const env: Record<string, string | undefined> = { MODE: "production" };
  const netlifyEnv = (globalThis as { Netlify?: { env?: { get(key: string): string | undefined } } }).Netlify?.env;
  for (const key of ENV_KEYS) {
    env[key] = netlifyEnv?.get(key) ?? process.env[key];
  }
  return env as UnderstandEnv;
}

export default async (req: Request, context: Context) => {
  return handleUnderstand(req, readEnv(), { clientIp: context?.ip });
};

export const config: Config = {
  path: "/api/understand",
};
