import type { Entry, EventConfig, Match, MatchResult, StandingRow } from "./types";
import { poolsOf } from "./schedule";

export type Results = Record<string, MatchResult | undefined>;

interface Acc extends StandingRow {
  h2h: Record<string, number>; // entryId -> wins against that entry
}

/** Standings per pool. Order: wins, point diff, points for, head-to-head (2-way ties), entry order. */
export function computeStandings(
  entries: Entry[],
  matches: Match[],
  results: Results,
  cfg: Pick<EventConfig, "levels" | "levelMode" | "winMode" | "advance">,
): Record<string, StandingRow[]> {
  const out: Record<string, StandingRow[]> = {};
  for (const pool of poolsOf(entries, cfg)) {
    const acc = new Map<string, Acc>();
    pool.entries.forEach((e) =>
      acc.set(e.id, { entryId: e.id, gp: 0, w: 0, l: 0, pf: 0, pa: 0, diff: 0, byCategory: {}, rank: 0, advances: false, h2h: {} }),
    );
    const poolMatches = matches.filter((m) => m.poolId === pool.id);

    // group category games into team matches for per_match mode
    const tally = new Map<string, { a: number; b: number; ma: string; mb: string }>();
    for (const m of poolMatches) {
      const r = results[m.id];
      if (!r || !r.final) continue;
      const ea = r.entryA ?? m.a;
      const eb = r.entryB ?? m.b;
      const A = acc.get(ea);
      const B = acc.get(eb);
      if (!A || !B) continue;
      const aWon = r.a > r.b;
      for (const [row, f, x, won] of [[A, r.a, r.b, aWon], [B, r.b, r.a, !aWon]] as const) {
        row.gp++;
        row.pf += f;
        row.pa += x;
        const cat = m.category ?? "-";
        row.byCategory[cat] ??= [0, 0];
        row.byCategory[cat][won ? 0 : 1]++;
        if (cfg.winMode === "per_game" || m.category === null) {
          if (won) row.w++;
          else row.l++;
        }
      }
      if (aWon) A.h2h[eb] = (A.h2h[eb] ?? 0) + 1;
      else B.h2h[ea] = (B.h2h[ea] ?? 0) + 1;
      if (cfg.winMode === "per_match" && m.category !== null) {
        const key = [ea, eb].sort().join("|");
        const t = tally.get(key) ?? { a: 0, b: 0, ma: [ea, eb].sort()[0], mb: [ea, eb].sort()[1] };
        const first = t.ma === ea;
        if (aWon === first) t.a++;
        else t.b++;
        tally.set(key, t);
      }
    }
    if (cfg.winMode === "per_match") {
      for (const t of tally.values()) {
        if (t.a === t.b) continue; // undecided match counts for nobody
        const [win, lose] = t.a > t.b ? [t.ma, t.mb] : [t.mb, t.ma];
        acc.get(win)!.w++;
        acc.get(lose)!.l++;
      }
    }

    const order = new Map(pool.entries.map((e, i) => [e.id, i]));
    const rows = [...acc.values()];
    rows.forEach((r) => (r.diff = r.pf - r.pa));
    rows.sort(
      (x, y) =>
        y.w - x.w || y.diff - x.diff || y.pf - x.pf || (order.get(x.entryId)! - order.get(y.entryId)!),
    );
    // head-to-head for two-way ties on wins + diff + pf
    for (let i = 0; i < rows.length - 1; i++) {
      const x = rows[i];
      const y = rows[i + 1];
      const tied = x.w === y.w && x.diff === y.diff && x.pf === y.pf;
      const nextTied = rows[i + 2] && rows[i + 2].w === y.w && rows[i + 2].diff === y.diff && rows[i + 2].pf === y.pf;
      const prevTied = i > 0 && rows[i - 1].w === x.w && rows[i - 1].diff === x.diff && rows[i - 1].pf === x.pf;
      if (tied && !nextTied && !prevTied && (y.h2h[x.entryId] ?? 0) > (x.h2h[y.entryId] ?? 0)) {
        rows[i] = y;
        rows[i + 1] = x;
      }
    }
    const played = rows.some((r) => r.gp > 0);
    out[pool.id] = rows.map((r, i) => {
      const { h2h: _h, ...clean } = r;
      void _h;
      return { ...clean, rank: i + 1, advances: played && i < cfg.advance };
    });
  }
  return out;
}
