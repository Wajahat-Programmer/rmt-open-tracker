export interface Config {
  baseUrl: string;
  apiToken: string;
  ntfyTopic: string;
}

export const EARLY_WINDOW_MS = 45_000;
export const REOPEN_GAP_SEC = 7200;
export const REG_TTL_SEC = 90 * 86400;

type Env = Record<string, string | undefined>;

function required(env: Env, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing env var ${key}`);
  return value;
}

export function loadConfig(env: Env = process.env): Config {
  const apiToken = required(env, "API_TOKEN");
  if (apiToken.length < 32) throw new Error("API_TOKEN must be at least 32 characters");

  const ntfyTopic = required(env, "NTFY_TOPIC");
  if (ntfyTopic.length < 16) throw new Error("NTFY_TOPIC must be at least 16 characters");

  let baseUrl: string;
  if (env.TRACKER_BASE_URL) {
    baseUrl = env.TRACKER_BASE_URL.replace(/\/+$/, "");
    if (!baseUrl.startsWith("https://")) throw new Error("TRACKER_BASE_URL must start with https://");
  } else if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    baseUrl = `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  } else {
    throw new Error("Set TRACKER_BASE_URL, or deploy on Vercel so VERCEL_PROJECT_PRODUCTION_URL exists");
  }

  return { baseUrl, apiToken, ntfyTopic };
}
