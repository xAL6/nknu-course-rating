// Refined, earthy palette for timetable course blocks (white-readable, no neon,
// harmonises with the gold theme). Shared by the on-screen grid and PNG export.
export const TT_PALETTE = [
  "#a8761f", // amber (brand family)
  "#7a6a45", // dark khaki
  "#5f7355", // muted sage
  "#4f6b78", // muted slate blue
  "#7a5566", // muted plum
  "#9c5f3a", // terracotta
];

export function colorFor(code: string): string {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % TT_PALETTE.length;
  return TT_PALETTE[h];
}
