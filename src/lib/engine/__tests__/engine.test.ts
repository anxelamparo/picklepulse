/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATEGORIES, DEFAULT_RULES, EventConfig, Entry, Level,
  generateSchedule, computeStandings, checkFinal, circleRounds,
} from "..";

const base: EventConfig = {
  entryType: "teams", levels: ["advanced"], levelMode: "separate",
  categories: DEFAULT_CATEGORIES, courts: 3, startMin: 840, slotMin: 15,
  rules: DEFAULT_RULES, winMode: "per_game", advance: 2,
};
const team = (id: string, level: Level = "advanced"): Entry => ({ id, name: id, level, players: [] });
const pair = (id: string, p1: string, p2: string, level: Level = "advanced"): Entry => ({
  id, name: id, level, players: [{ id: p1, name: p1 }, { id: p2, name: p2 }],
});

describe("circleRounds", () => {
  it("every pair meets exactly once, nobody twice per round", () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8]) {
      const items = Array.from({ length: n }, (_, i) => i);
      const rounds = circleRounds(items);
      const seen = new Set<string>();
      for (const r of rounds) {
        const inRound = new Set<number>();
        for (const [a, b] of r) {
          expect(inRound.has(a) || inRound.has(b)).toBe(false);
          inRound.add(a); inRound.add(b);
          seen.add([a, b].sort().join("-"));
        }
      }
      expect(seen.size).toBe((n * (n - 1)) / 2);
    }
  });
});

describe("generateSchedule - teams", () => {
  const entries = ["JAC", "MLA", "SIX", "MAR", "DINK", "JOC"].map((i) => team(i));
  const m = generateSchedule(entries, base);

  it("builds 45 games for 6 teams x 3 categories", () => expect(m).toHaveLength(45));
  it("each pair plays each category exactly once", () => {
    const keys = m.map((g) => [g.a, g.b].sort().join("|") + g.category);
    expect(new Set(keys).size).toBe(45);
  });
  it("never uses more courts than configured, one game per court per slot", () => {
    const seen = new Set<string>();
    for (const g of m) {
      expect(g.court).toBeGreaterThanOrEqual(1);
      expect(g.court).toBeLessThanOrEqual(3);
      const k = `${g.slot}-${g.court}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });
  it("no team plays the same category twice in one slot", () => {
    const seen = new Set<string>();
    for (const g of m)
      for (const t of [g.a, g.b]) {
        const k = `${g.slot}|${t}|${g.category}`;
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
  });
  it("packs tightly: 45 games on 3 courts finish in 15 slots", () =>
    expect(Math.max(...m.map((g) => g.slot))).toBe(15));
});

describe("generateSchedule - doubles + levels", () => {
  const entries = [
    pair("A", "a1", "a2", "novice"), pair("B", "b1", "b2", "novice"), pair("C", "c1", "c2", "novice"), pair("D", "d1", "d2", "novice"),
    pair("E", "e1", "e2", "advanced"), pair("F", "f1", "f2", "advanced"), pair("G", "g1", "g2", "advanced"),
  ];
  const cfg: EventConfig = { ...base, entryType: "doubles", levels: ["novice", "advanced"], courts: 2 };

  it("separate mode: round robin inside each level only", () => {
    const m = generateSchedule(entries, cfg);
    expect(m.filter((g) => g.level === "novice")).toHaveLength(6);
    expect(m.filter((g) => g.level === "advanced")).toHaveLength(3);
    for (const g of m) {
      const lv = (id: string) => entries.find((e) => e.id === id)!.level;
      expect(lv(g.a)).toBe(lv(g.b));
    }
  });
  it("mixed mode: one pool, everyone meets everyone", () => {
    const m = generateSchedule(entries, { ...cfg, levelMode: "mixed" });
    expect(m).toHaveLength(21);
    expect(new Set(m.map((g) => g.poolId))).toEqual(new Set(["all"]));
  });
  it("a player never appears on two courts in one slot", () => {
    const m = generateSchedule(entries, { ...cfg, levelMode: "mixed", courts: 3 });
    const by = new Map<number, string[]>();
    for (const g of m) {
      const ids = [...entries.find((e) => e.id === g.a)!.players, ...entries.find((e) => e.id === g.b)!.players].map((p) => p.id);
      const arr = by.get(g.slot) ?? [];
      for (const id of ids) expect(arr).not.toContain(id);
      by.set(g.slot, [...arr, ...ids]);
    }
  });
  it("two pairs sharing a player are never scheduled together", () => {
    const shared = [pair("X", "p1", "p2"), pair("Y", "p1", "p3"), pair("Z", "p4", "p5"), pair("W", "p6", "p7")];
    const m = generateSchedule(shared, { ...cfg, levels: ["advanced"], courts: 4 });
    expect(m.filter((g) => [g.a, g.b].includes("X") && [g.a, g.b].includes("Y"))).toHaveLength(1);
    const bySlot = new Map<number, number>();
    for (const g of m) if ([g.a, g.b].some((id) => id === "X" || id === "Y")) bySlot.set(g.slot, (bySlot.get(g.slot) ?? 0) + 1);
    for (const n of bySlot.values()) expect(n).toBe(1); // X and Y share p1, so only one of their games per slot
  });
});

describe("computeStandings", () => {
  const entries = ["A", "B", "C"].map((i) => team(i));
  const cfg = { ...base, categories: [DEFAULT_CATEGORIES[0]] };
  const m = generateSchedule(entries, cfg);
  const find = (x: string, y: string) => m.find((g) => [g.a, g.b].sort().join() === [x, y].sort().join())!;

  it("ranks by wins, then point difference", () => {
    const res: Record<string, any> = {};
    const g1 = find("A", "B"), g2 = find("A", "C"), g3 = find("B", "C");
    res[g1.id] = { a: g1.a === "A" ? 21 : 10, b: g1.a === "A" ? 10 : 21, final: true };
    res[g2.id] = { a: g2.a === "A" ? 21 : 19, b: g2.a === "A" ? 19 : 21, final: true };
    res[g3.id] = { a: g3.a === "B" ? 21 : 5, b: g3.a === "B" ? 5 : 21, final: true };
    const s = computeStandings(entries, m, res, cfg).advanced;
    expect(s.map((r) => r.entryId)).toEqual(["A", "B", "C"]);
    expect(s[0]).toMatchObject({ w: 2, l: 0, gp: 2 });
    expect(s[0].advances && s[1].advances && !s[2].advances).toBe(true);
  });
  it("ignores games that are not final and substitutes entries", () => {
    const g = find("A", "B");
    const live = computeStandings(entries, m, { [g.id]: { a: 5, b: 3, final: false } }, cfg).advanced;
    expect(live.every((r) => r.gp === 0 && !r.advances)).toBe(true);
    const sub = computeStandings(entries, m, { [g.id]: { a: 21, b: 3, final: true, entryA: "C", entryB: "B" } }, cfg).advanced;
    expect(sub.find((r) => r.entryId === "C")!.w).toBe(1);
    expect(sub.find((r) => r.entryId === "A")!.gp).toBe(0);
  });
  it("per_match mode: team wins by majority of category games", () => {
    const three = generateSchedule(entries, base);
    const games = three.filter((g) => [g.a, g.b].sort().join() === "A,B");
    const res: Record<string, any> = {};
    games.forEach((g, i) => {
      const aWins = i < 2;
      res[g.id] = { a: (g.a === "A") === aWins ? 21 : 10, b: (g.a === "A") === aWins ? 10 : 21, final: true };
    });
    const s = computeStandings(entries, three, res, { ...base, winMode: "per_match" }).advanced;
    expect(s.find((r) => r.entryId === "A")).toMatchObject({ w: 1, l: 0, gp: 3 });
    expect(s.find((r) => r.entryId === "B")).toMatchObject({ w: 0, l: 1 });
  });
});

describe("checkFinal", () => {
  it("validates rally to 21", () => {
    expect(checkFinal(21, 18, DEFAULT_RULES).ok).toBe(true);
    expect(checkFinal(21, 21, DEFAULT_RULES)).toMatchObject({ ok: false, soft: false });
    expect(checkFinal(15, 10, DEFAULT_RULES)).toMatchObject({ ok: false, soft: true });
  });
  it("win by 2 with cap", () => {
    const r = { targetScore: 11, winBy: 2 as const, cap: 15 };
    expect(checkFinal(11, 9, r).ok).toBe(true);
    expect(checkFinal(11, 10, r)).toMatchObject({ ok: false, soft: true });
    expect(checkFinal(15, 14, r).ok).toBe(true);
    expect(checkFinal(16, 14, r)).toMatchObject({ ok: false, soft: false });
  });
});
