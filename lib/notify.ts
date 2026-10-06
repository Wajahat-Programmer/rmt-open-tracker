import type { Config } from "./config";

export interface Notification {
  title: string;
  message: string;
}

export async function sendNtfy(cfg: Config, n: Notification): Promise<void> {
  const res = await fetch(`https://ntfy.sh/${cfg.ntfyTopic}`, {
    method: "POST",
    headers: { Title: n.title, Priority: "4" },
    body: n.message,
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`ntfy responded ${res.status}`);
}
