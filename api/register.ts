import type { VercelRequest, VercelResponse } from "@vercel/node";
import { bearerOk } from "../lib/auth";
import { getDeps } from "../lib/deps";
import { parseRegisterBody, register } from "../lib/tracker";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const deps = getDeps();
  if (!bearerOk(req.headers.authorization, deps.cfg.apiToken)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const input = parseRegisterBody(req.body);
  if (!input) return res.status(400).json({ error: "invalid_body" });

  const { id, url } = await register(deps, input);
  return res.status(201).json({ id, url });
}
