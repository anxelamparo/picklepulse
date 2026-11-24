import type { Entry, Level, Player } from "./engine";

const P = (name: string, gender: "M" | "W"): Player => ({ id: crypto.randomUUID(), name, gender });

/** Six sample teams (3 men + 3 women each) so a club can try the app in one click. */
export function sampleTeams(level: Level = "advanced"): Entry[] {
  const raw: [string, string, string[], string[]][] = [
    ["Smash Bros", "#1d4ed8", ["Alex", "Ben", "Carlo"], ["Dana", "Ella", "Faye"]],
    ["Net Ninjas", "#16a34a", ["Gabe", "Hugo", "Ian"], ["Jade", "Kim", "Lia"]],
    ["Dink Dynasty", "#dc2626", ["Marco", "Nico", "Owen"], ["Pia", "Quinn", "Rae"]],
    ["Kitchen Crew", "#9333ea", ["Sam", "Theo", "Uri"], ["Vera", "Wynn", "Xia"]],
    ["Paddle Pirates", "#ea580c", ["Yan", "Zed", "Abe"], ["Bea", "Cleo", "Dot"]],
    ["Lob Legends", "#0891b2", ["Eli", "Fox", "Gus"], ["Hana", "Ivy", "Joy"]],
  ];
  return raw.map(([name, color, men, women]) => ({
    id: crypto.randomUUID(), name, level, color,
    players: [...men.map((n) => P(n, "M")), ...women.map((n) => P(n, "W"))],
  }));
}

export function sampleDoubles(level: Level): Entry[] {
  const names = ["Alex & Dana", "Ben & Ella", "Carlo & Faye", "Gabe & Jade", "Hugo & Kim", "Ian & Lia"];
  return names.map((n) => {
    const [a, b] = n.split(" & ");
    return { id: crypto.randomUUID(), name: n, level, players: [P(a, "M"), P(b, "W")] };
  });
}
