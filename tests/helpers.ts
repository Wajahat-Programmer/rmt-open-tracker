import type { Config } from "../lib/config";
import type { Notification } from "../lib/notify";
import { MemoryStore } from "../lib/store";
import type { Deps } from "../lib/tracker";

export const BASE_CFG: Config = {
  baseUrl: "https://t.example.com",
  apiToken: "a".repeat(32),
  ntfyTopic: "t".repeat(16),
};

export const HUMAN_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36";

export function makeDeps(startMs: number) {
  const clock = { now: startMs };
  const sent: Notification[] = [];
  const failures = { next: false };
  const deps: Deps = {
    cfg: BASE_CFG,
    store: new MemoryStore(() => clock.now),
    now: () => clock.now,
    notify: async (n) => {
      if (failures.next) throw new Error("ntfy down");
      sent.push(n);
    },
  };
  return { deps, clock, sent, failures };
}

export const MIDDAY = Date.UTC(2026, 9, 7, 12, 0, 0);
