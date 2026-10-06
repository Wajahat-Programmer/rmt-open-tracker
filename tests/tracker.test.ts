import { describe, expect, it } from "vitest";
import { REOPEN_GAP_SEC } from "../lib/config";
import { ID_PATTERN, listOpens, parseRegisterBody, recordHit, register } from "../lib/tracker";
import { HUMAN_UA, MIDDAY, makeDeps } from "./helpers";

const input = { leadKey: "L-001", label: "Dr. Khan (Acme Cardiology)", step: 2 };

describe("register", () => {
  it("returns a 22-char id and a pixel url on the configured base", async () => {
    const { deps } = makeDeps(MIDDAY);
    const { id, url } = await register(deps, input);
    expect(id).toMatch(ID_PATTERN);
    expect(url).toBe(`https://t.example.com/o/${id}.gif`);
  });
});

describe("recordHit", () => {
  it("ignores unknown ids without notifying", async () => {
    const { deps, sent } = makeDeps(MIDDAY);
    expect(await recordHit(deps, "x".repeat(22), HUMAN_UA)).toBe("unknown");
    expect(sent).toHaveLength(0);
  });

  it("treats a hit inside the early window as filtered", async () => {
    const { deps, clock, sent } = makeDeps(MIDDAY);
    const { id } = await register(deps, input);
    clock.now += 10_000;
    expect(await recordHit(deps, id, HUMAN_UA)).toBe("early");
    expect(sent).toHaveLength(0);
    expect(await listOpens(deps, 0)).toHaveLength(0);
  });

  it("treats scanner and empty user agents as filtered", async () => {
    const { deps, clock, sent } = makeDeps(MIDDAY);
    const { id } = await register(deps, input);
    clock.now += 120_000;
    expect(await recordHit(deps, id, "Mozilla/5.0 Proofpoint")).toBe("scanner");
    expect(await recordHit(deps, id, "")).toBe("scanner");
    expect(sent).toHaveLength(0);
  });

  it("pushes once for the first real open and suppresses repeats inside the gap", async () => {
    const { deps, clock, sent } = makeDeps(MIDDAY);
    const { id } = await register(deps, input);
    clock.now += 600_000;
    await recordHit(deps, id, HUMAN_UA);
    clock.now += 60_000;
    await recordHit(deps, id, HUMAN_UA);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.message).toBe("Dr. Khan (Acme Cardiology) - step 2");
  });

  it("pushes again after the cooldown and marks it as opened again", async () => {
    const { deps, clock, sent } = makeDeps(MIDDAY);
    const { id } = await register(deps, input);
    clock.now += 600_000;
    await recordHit(deps, id, HUMAN_UA);
    clock.now += REOPEN_GAP_SEC * 1000 + 1000;
    await recordHit(deps, id, HUMAN_UA);
    expect(sent).toHaveLength(2);
    expect(sent[1]?.message).toBe("Dr. Khan (Acme Cardiology) - step 2 (opened again)");
  });

  it("still records the open when the push fails", async () => {
    const { deps, clock, failures } = makeDeps(MIDDAY);
    const { id } = await register(deps, input);
    clock.now += 600_000;
    failures.next = true;
    expect(await recordHit(deps, id, HUMAN_UA)).toBe("open");
    expect(await listOpens(deps, 0)).toHaveLength(1);
  });
});

describe("listOpens", () => {
  it("reports counts, timestamps and filtered hits, honouring since", async () => {
    const { deps, clock } = makeDeps(MIDDAY);
    const { id } = await register(deps, input);
    clock.now += 5_000;
    await recordHit(deps, id, HUMAN_UA);
    clock.now += 600_000;
    await recordHit(deps, id, HUMAN_UA);
    const lastOpen = clock.now;

    const all = await listOpens(deps, 0);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ lead_key: "L-001", step: 2, open_count: 1, filtered_hits: 1 });
    expect(all[0]?.last_open_at).toBe(new Date(lastOpen).toISOString());

    expect(await listOpens(deps, lastOpen + 1)).toHaveLength(0);
  });
});

describe("parseRegisterBody", () => {
  it("accepts a valid body and strips control characters from the label", () => {
    expect(parseRegisterBody({ lead_key: "L-1", label: "Dr X\n(Acme)", step: 1 })).toEqual({
      leadKey: "L-1",
      label: "Dr X (Acme)",
      step: 1,
    });
  });

  it.each([
    null,
    "text",
    { lead_key: "bad key!", label: "x", step: 1 },
    { lead_key: "L-1", label: "", step: 1 },
    { lead_key: "L-1", label: "x".repeat(121), step: 1 },
    { lead_key: "L-1", label: "x", step: 4 },
    { lead_key: "L-1", label: "x", step: "2" },
  ])("rejects %j", (body) => {
    expect(parseRegisterBody(body)).toBeNull();
  });
});
