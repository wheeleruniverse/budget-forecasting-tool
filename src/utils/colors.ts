/** Fallback palette for accounts that don't declare their own color. */
const PALETTE = [
  '#7c3aed', // purple
  '#e65a2e', // coral
  '#0891b2', // cyan
  '#16a34a', // green
  '#ca8a04', // yellow
  '#db2777', // pink
  '#2563eb', // blue
  '#78716c', // stone
];

export function accountColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
