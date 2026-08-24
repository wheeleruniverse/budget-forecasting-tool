/**
 * Chart.js registration. Only the controllers, elements, and plugins the app
 * actually draws are registered, so the tree-shaken bundle stays small.
 * Import this module for its side effect before rendering any chart.
 */
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip
);

/** Hairline grid, one shade off the white card surface. */
export const GRID_COLOR = '#e2e8f0';
/** Axis and tick ink — recessive against the data. */
export const AXIS_INK = '#64748b';
/** Card surface, used as the gap between adjacent and stacked fills. */
export const SURFACE = '#ffffff';

Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
Chart.defaults.color = AXIS_INK;
