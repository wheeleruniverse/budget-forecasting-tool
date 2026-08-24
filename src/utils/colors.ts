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

/**
 * Categorical slots for charts that must tell series apart, in a fixed order
 * validated for colour-vision deficiency against a white surface (worst
 * adjacent pair ΔE 9.1, target ≥ 8). The ORDER is the safety mechanism, so
 * reordering or extending this list invalidates it — fold a long tail into
 * "Other" instead of adding a ninth hue.
 *
 * Aqua, yellow and magenta fall below 3:1 contrast on white, so any chart
 * using them ships visible labels or a table view alongside.
 */
const CATEGORICAL = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
];

/** Slot for the folded "Other" bin — deliberately outside the hue order. */
const CATEGORICAL_TAIL = '#898781';

export function categoryColor(index: number): string {
  return CATEGORICAL[index] ?? CATEGORICAL_TAIL;
}

/** Single hue for magnitude-only charts, where every mark is one series. */
export const MAGNITUDE_HUE = '#7c3aed';
