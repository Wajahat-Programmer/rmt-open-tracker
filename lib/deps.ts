import { loadConfig } from "./config";
import { sendNtfy } from "./notify";
import { createRedisStore } from "./store";
import type { Deps } from "./tracker";

let cached: Deps | undefined;

export function getDeps(): Deps {
  if (!cached) {
    const cfg = loadConfig();
    cached = {
      cfg,
      store: createRedisStore(),
      notify: (n) => sendNtfy(cfg, n),
      now: Date.now,
    };
  }
  return cached;
}
