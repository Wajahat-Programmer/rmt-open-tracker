export type HitKind = "early" | "scanner" | "open";

const SCANNER_UA =
  /(proofpoint|mimecast|barracuda|forcepoint|symantec|trendmicro|bot\b|crawler|spider|scanner|python-requests|curl\/|wget|go-http-client|java\/|okhttp|headless)/i;

export function classify(userAgent: string, msSinceSend: number, earlyWindowMs: number): HitKind {
  if (msSinceSend < earlyWindowMs) return "early";
  if (!userAgent || SCANNER_UA.test(userAgent)) return "scanner";
  return "open";
}
