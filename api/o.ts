import type { VercelRequest, VercelResponse } from "@vercel/node";
import { TRANSPARENT_GIF } from "../lib/gif";
import { getDeps } from "../lib/deps";
import { ID_PATTERN, recordHit } from "../lib/tracker";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");

  const file = typeof req.query.file === "string" ? req.query.file : "";
  const id = file.replace(/\.gif$/, "");

  if (req.method === "GET" && ID_PATTERN.test(id)) {
    try {
      await recordHit(getDeps(), id, req.headers["user-agent"] ?? "");
    } catch (err) {
      console.error("recordHit failed:", err instanceof Error ? err.message : "unknown error");
    }
  }

  res.status(200).send(TRANSPARENT_GIF);
}
