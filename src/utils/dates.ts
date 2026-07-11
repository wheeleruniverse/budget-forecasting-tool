/**
 * Date helpers operating on 'YYYY-MM-DD' strings. All math goes through
 * Date.UTC so results never shift with the local timezone.
 */

export function parseDate(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

export function toDateString(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const { y, m, d } = parseDate(date);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(date: string, days: number): string {
  const { y, m, d } = parseDate(date);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return toDateString(
    utc.getUTCFullYear(),
    utc.getUTCMonth() + 1,
    utc.getUTCDate()
  );
}

/** Adds months, clamping the day to the target month (Jan 31 + 1mo = Feb 28/29). */
export function addMonths(
  date: string,
  months: number,
  dayOfMonth?: number | 'last'
): string {
  const { y, m, d } = parseDate(date);
  const totalMonths = y * 12 + (m - 1) + months;
  const ty = Math.floor(totalMonths / 12);
  const tm = (totalMonths % 12) + 1;
  const targetDay = dayOfMonth === 'last' ? Infinity : (dayOfMonth ?? d);
  const clamped = Math.min(targetDay, daysInMonth(ty, tm));
  return toDateString(ty, tm, clamped);
}

/** Number of days from a to b (positive when b is after a). */
export function diffDays(a: string, b: string): number {
  const pa = parseDate(a);
  const pb = parseDate(b);
  const ua = Date.UTC(pa.y, pa.m - 1, pa.d);
  const ub = Date.UTC(pb.y, pb.m - 1, pb.d);
  return Math.round((ub - ua) / 86_400_000);
}

/** Today's date in the user's local timezone. */
export function today(): string {
  const now = new Date();
  return toDateString(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Local timestamp for filenames: YYYYMMDD-HHMMSS. */
export function fileTimestamp(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

const displayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDisplayDate(date: string): string {
  const { y, m, d } = parseDate(date);
  return displayFormat.format(new Date(Date.UTC(y, m - 1, d)));
}
