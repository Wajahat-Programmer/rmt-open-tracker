import { randomBytes } from "node:crypto";
import { EARLY_WINDOW_MS, REG_TTL_SEC, REOPEN_GAP_SEC, type Config } from "./config";
import type { Notification } from "./notify";
import { classify, type HitKind } from "./policy";
import type { Store } from "./store";

export interface Deps {
  store: Store;
  cfg: Config;
  notify: (n: Notification) => Promise<void>;
  now: () => number;
}

export interface Registration {
  leadKey: string;
  label: string;
  step: number;
  sentAt: number;
}

export interface OpenRecord {
  id: string;
  lead_key: string;
  step: number;
  first_open_at: string;
  last_open_at: string;
  open_count: number;
  filtered_hits: number;
}

export const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

const LEAD_KEY_PATTERN = /^[\w.@:-]{1,100}$/;

export function parseRegisterBody(body: unknown): Omit<Registration, "sentAt"> | null {
  if (typeof body !== "object" || body === null) return null;
  const { lead_key, label, step } = body as Record<string, unknown>;
  if (typeof lead_key !== "string" || !LEAD_KEY_PATTERN.test(lead_key)) return null;
  if (typeof label !== "string") return null;
  const cleanLabel = label.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (cleanLabel.length < 1 || cleanLabel.length > 120) return null;
  if (typeof step !== "number" || !Number.isInteger(step) || step < 1 || step > 3) return null;
  return { leadKey: lead_key, label: cleanLabel, step };
}

export async function register(
  d: Deps,
  input: Omit<Registration, "sentAt">,
): Promise<{ id: string; url: string }> {
  const id = randomBytes(16).toString("base64url");
  const reg: Registration = { ...input, sentAt: d.now() };
  await d.store.set(`reg:${id}`, JSON.stringify(reg), REG_TTL_SEC);
  return { id, url: `${d.cfg.baseUrl}/o/${id}.gif` };
}

async function loadRegistration(d: Deps, id: string): Promise<Registration | null> {
  const raw = await d.store.get(`reg:${id}`);
  return raw ? (JSON.parse(raw) as Registration) : null;
}

function describe(reg: Registration, again: boolean): string {
  return `${reg.label} - step ${reg.step}${again ? " (opened again)" : ""}`;
}

export async function recordHit(
  d: Deps,
  id: string,
  userAgent: string,
): Promise<HitKind | "unknown"> {
  const reg = await loadRegistration(d, id);
  if (!reg) return "unknown";

  const now = d.now();
  const kind = classify(userAgent, now - reg.sentAt, EARLY_WINDOW_MS);
  if (kind !== "open") {
    await d.store.incr(`n:${id}:${kind}`);
    return kind;
  }

  const count = await d.store.incr(`n:${id}:open`);
  const stamp = String(now);
  await d.store.setNx(`first:${id}`, stamp, REG_TTL_SEC);
  await d.store.set(`last:${id}`, stamp, REG_TTL_SEC);
  await d.store.zadd("opens:idx", now, id);

  const allowed = await d.store.setNx(`push:${id}`, stamp, REOPEN_GAP_SEC);
  if (!allowed) return "open";

  try {
    await d.notify({ title: "Email opened", message: describe(reg, count > 1) });
  } catch (err) {
    console.error("push failed:", err instanceof Error ? err.message : "unknown error");
  }
  return "open";
}

export async function listOpens(d: Deps, sinceMs: number): Promise<OpenRecord[]> {
  const ids = await d.store.zrangeByScore("opens:idx", sinceMs);
  const records: OpenRecord[] = [];
  for (const id of ids) {
    const reg = await loadRegistration(d, id);
    if (!reg) continue;
    const [first, last, opens, early, scanner] = await Promise.all([
      d.store.get(`first:${id}`),
      d.store.get(`last:${id}`),
      d.store.get(`n:${id}:open`),
      d.store.get(`n:${id}:early`),
      d.store.get(`n:${id}:scanner`),
    ]);
    if (!first || !last) continue;
    records.push({
      id,
      lead_key: reg.leadKey,
      step: reg.step,
      first_open_at: new Date(Number(first)).toISOString(),
      last_open_at: new Date(Number(last)).toISOString(),
      open_count: Number(opens ?? 0),
      filtered_hits: Number(early ?? 0) + Number(scanner ?? 0),
    });
  }
  return records;
}
