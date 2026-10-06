import type { VercelRequest, VercelResponse } from "@vercel/node";
import { bearerOk } from "../lib/auth";
import { getDeps } from "../lib/deps";
import { listOpens } from "../lib/tracker";

function parseSince(raw: unknown): number | null {
  if (raw === undefined || raw === "") return 0;
  if (typeof raw !== "string") return null;
  const n = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const deps = getDeps();
  if (!bearerOk(req.headers.authorization, deps.cfg.apiToken)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const since = parseSince(req.query.since);
  if (since === null) return res.status(400).json({ error: "invalid_since" });

  const opens = await listOpens(deps, since);
  return res.status(200).json({ opens, server_time: new Date(deps.now()).toISOString() });
}
