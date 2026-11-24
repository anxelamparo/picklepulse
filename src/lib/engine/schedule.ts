import type { Entry, EventConfig, Level, Match } from "./types";

/** Round robin pairings with the circle method. Each entry plays once per round. */
export function circleRounds<T>(items: T[]): [T, T][][] {
  const list: (T | null)[] = [...items];
  if (list.length % 2 === 1) list.push(null); // bye
  const n = list.length;
  const rounds: [T, T][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [T, T][] = [];
    for (let i = 0; i < n / 2; i++) {
      const x = list[i];
      const y = list[n - 1 - i];
      if (x !== null && y !== null) round.push([x, y]);
    }
    rounds.push(round);
    // rotate everything except the first element
    list.splice(1, 0, list.pop() as T | null);
  }
  return rounds;
}

interface Draft {
  poolId: string;
  level: Level;
  category: string | null;
  a: Entry;
  b: Entry;
  order: number;
  resources: string[];
}

export function poolsOf(entries: Entry[], cfg: Pick<EventConfig, "levels" | "levelMode">) {
  const usable = entries.filter((e) => cfg.levels.includes(e.level));
  if (cfg.levelMode === "mixed") return [{ id: "all", entries: usable }];
  return cfg.levels
    .map((lv) => ({ id: lv as string, entries: usable.filter((e) => e.level === lv) }))
    .filter((p) => p.entries.length > 0);
}

/**
 * Builds the full schedule.
 *  - every pair of entries in a pool meets once (per category in teams mode)
 *  - nobody is in two games in the same slot (teams: a team may play different
 *    categories at the same time because those are different players)
 *  - at most cfg.courts games per slot, filled greedily, longest-waiting first
 */
export function generateSchedule(entries: Entry[], cfg: EventConfig): Match[] {
  const drafts: Draft[] = [];
  let order = 0;
  const pools = poolsOf(entries, cfg);
  const roundsPerPool = pools.map((p) => circleRounds(p.entries));
  const maxRounds = Math.max(0, ...roundsPerPool.map((r) => r.length));

  // interleave pools round by round so levels share courts fairly
  for (let r = 0; r < maxRounds; r++) {
    pools.forEach((pool, pi) => {
      for (const [a, b] of roundsPerPool[pi][r] ?? []) {
        if (cfg.entryType === "teams") {
          for (const cat of cfg.categories) {
            drafts.push({
              poolId: pool.id, level: a.level, category: cat.code, a, b, order: order++,
              resources: [`${a.id}|${cat.code}`, `${b.id}|${cat.code}`],
            });
          }
        } else {
          // doubles: resources are the real players, so one person can't be on two courts
          const ids = [...a.players, ...b.players].map((p) => `p:${p.id}`);
          drafts.push({
            poolId: pool.id, level: a.level, category: null, a, b, order: order++,
            resources: ids.length ? ids : [`e:${a.id}`, `e:${b.id}`],
          });
        }
      }
    });
  }

  const placed: Match[] = [];
  const pending = [...drafts];
  const lastSlot = new Map<string, number>(); // resource -> last slot it played
  let slot = 1;
  while (pending.length) {
    const used = new Set<string>();
    const picked: Draft[] = [];
    // longest-waiting first, ties by generation order (keeps round structure)
    const ranked = pending
      .map((d) => ({ d, wait: Math.min(...d.resources.map((x) => slot - (lastSlot.get(x) ?? 0))) }))
      .sort((x, y) => y.wait - x.wait || x.d.order - y.d.order);
    for (const { d } of ranked) {
      if (picked.length >= cfg.courts) break;
      if (d.resources.some((x) => used.has(x))) continue;
      d.resources.forEach((x) => used.add(x));
      picked.push(d);
    }
    picked.sort((x, y) => x.order - y.order);
    picked.forEach((d, i) => {
      d.resources.forEach((x) => lastSlot.set(x, slot));
      placed.push({
        id: "", n: 0, poolId: d.poolId, level: d.level, category: d.category,
        a: d.a.id, b: d.b.id, slot, court: i + 1,
      });
      pending.splice(pending.indexOf(d), 1);
    });
    slot++;
    if (slot > drafts.length + 5) throw new Error("Schedule could not be packed");
  }
  placed.forEach((m, i) => {
    m.n = i + 1;
    m.id = "G" + String(i + 1).padStart(2, "0");
  });
  return placed;
}

export function slotStart(cfg: Pick<EventConfig, "startMin" | "slotMin">, slot: number) {
  return cfg.startMin + (slot - 1) * cfg.slotMin;
}

export function formatClock(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/** Quick facts for the wizard preview: games, slots, finish time. */
export function scheduleSummary(matches: Match[], cfg: Pick<EventConfig, "startMin" | "slotMin">) {
  const slots = Math.max(0, ...matches.map((m) => m.slot));
  return {
    games: matches.length,
    slots,
    endsAt: formatClock(cfg.startMin + slots * cfg.slotMin),
  };
}
