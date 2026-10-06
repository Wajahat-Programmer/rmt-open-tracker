import { describe, expect, it } from "vitest";
import { classify } from "../lib/policy";
import { HUMAN_UA } from "./helpers";

describe("classify", () => {
  it("flags early, scanner and open hits", () => {
    expect(classify(HUMAN_UA, 1000, 45_000)).toBe("early");
    expect(classify("python-requests/2.31", 60_000, 45_000)).toBe("scanner");
    expect(classify("", 60_000, 45_000)).toBe("scanner");
    expect(classify(HUMAN_UA, 60_000, 45_000)).toBe("open");
  });

  it("does not treat the Gmail image proxy as a scanner", () => {
    const gmail = "Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)";
    expect(classify(gmail, 60_000, 45_000)).toBe("open");
  });
});
