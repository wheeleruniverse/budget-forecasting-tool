import type { BudgetConfig } from '@/types';
import { addMonths, parseDate, toDateString } from './dates';
import { buildLines } from './ledger';
import { fromCents, toCents } from './money';

/**
 * Bin keys are prefixed by origin so a real category can never merge with a
 * merchant name that happens to match it.
 */
const CATEGORY_PREFIX = 'c:';
const NAME_PREFIX = 'n:';

/** Bin key for untagged spending when name grouping is off. */
export const UNCATEGORIZED_KEY = CATEGORY_PREFIX;
/** Display label for the no-category bin. */
export const UNCATEGORIZED_LABEL = 'Uncategorized';
/** Synthetic key for the folded tail in `topCategories`. */
export const OTHER_KEY = '__other__';
/** Display label for the folded tail. */
export const OTHER_LABEL = 'Other';

export interface CategoryTotal {
  /** Opaque grouping key, prefixed by origin. Stable across re-renders. */
  key: string;
  /** Human label: the first spelling seen in the data. */
  label: string;
  /** Positive magnitude of money out, in the account's own currency. */
  spent: number;
  /** Positive magnitude of money in. */
  received: number;
  /** Lines that contributed, spending and income alike. */
  count: number;
  /** Fraction of total spending, 0–1. Zero when nothing was spent. */
  share: number;
  /**
   * True when this bin came from the entry name rather than a real category —
   * a provisional grouping, not something the user tagged.
   */
  derived: boolean;
  /** Ids of the entries in this bin, for bulk retagging. */
  entryIds: string[];
}

export interface SummarizeOptions {
  /**
   * Bin untagged entries by their name instead of lumping them together.
   * Repeated merchants collapse into one row, which is what makes bulk
   * retagging practical. Defaults to true.
   */
  groupUntaggedByName?: boolean;
}

export interface CategoryMonth {
  /** YYYY-MM. */
  month: string;
  /** Spending per category key. Absent keys spent nothing that month. */
  spentByKey: Record<string, number>;
  /** All categories summed. */
  spent: number;
}

export interface CategorySummary {
  /** Every category seen, ranked by spending descending. */
  totals: CategoryTotal[];
  /** One bucket per calendar month in range, chronological, gaps included. */
  months: CategoryMonth[];
  totalSpent: number;
  totalReceived: number;
  /** Spending with no category — the size of the tagging gap. */
  uncategorizedSpent: number;
  lineCount: number;
}

/** Casefolds and collapses whitespace so "Food", "food " and "FOOD" bin together. */
export function categoryKey(category: string | undefined): string {
  return (category ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Trims and collapses inner whitespace without casefolding, for display. */
function displayText(text: string | undefined): string {
  return (text ?? '').trim().replace(/\s+/g, ' ');
}

/** Every YYYY-MM from `from` through `through`, inclusive. */
function monthsBetween(from: string, through: string): string[] {
  const start = parseDate(from);
  const end = parseDate(through);
  const lastMonth = `${end.y}-${String(end.m).padStart(2, '0')}`;
  const months: string[] = [];
  let cursor = toDateString(start.y, start.m, 1);
  // Bounded so a reversed or malformed range can never spin forever.
  for (let i = 0; i < 600; i++) {
    const month = cursor.slice(0, 7);
    if (month > lastMonth) break;
    months.push(month);
    cursor = addMonths(cursor, 1, 1);
  }
  return months;
}

/**
 * Bins one account's realized spending by category over [from, through].
 *
 * Only `entry` lines count. Rule-generated lines are forecast, not history,
 * so they are excluded — this answers "where did the money go", not "where
 * will it go". Transfers are excluded too: `movementToLines` copies the same
 * category onto both legs, so counting them would net a self-transfer to
 * roughly zero while inflating the line count. The signal is `line.transfer`,
 * not a category literally spelled "transfer".
 *
 * Amounts stay in the account's own currency — no FX conversion happens here.
 */
export function summarizeCategories(
  config: BudgetConfig,
  accountId: string,
  from: string,
  through: string,
  options: SummarizeOptions = {}
): CategorySummary {
  const groupUntaggedByName = options.groupUntaggedByName ?? true;

  const spentCents = new Map<string, number>();
  const receivedCents = new Map<string, number>();
  const counts = new Map<string, number>();
  const labels = new Map<string, string>();
  const derivedKeys = new Set<string>();
  const entryIds = new Map<string, string[]>();
  const monthly = new Map<string, Map<string, number>>();

  let totalSpentCents = 0;
  let totalReceivedCents = 0;
  let untaggedSpentCents = 0;
  let lineCount = 0;

  const bump = (map: Map<string, number>, key: string, cents: number): void => {
    map.set(key, (map.get(key) ?? 0) + cents);
  };

  for (const line of buildLines(config, from, through)) {
    if (line.accountId !== accountId) continue;
    if (line.source !== 'entry') continue;
    if (line.transfer) continue;

    const category = displayText(line.category);
    const name = displayText(line.name);
    let key: string;
    let label: string;
    if (category) {
      key = CATEGORY_PREFIX + categoryKey(category);
      label = category;
    } else if (groupUntaggedByName && name) {
      key = NAME_PREFIX + categoryKey(name);
      label = name;
      derivedKeys.add(key);
    } else {
      key = UNCATEGORIZED_KEY;
      label = UNCATEGORIZED_LABEL;
    }

    if (!labels.has(key)) labels.set(key, label);
    bump(counts, key, 1);
    // Transfers are already filtered out, so an entry line's id is its
    // entry id — `movementToLines` only suffixes the transfer legs.
    const ids = entryIds.get(key);
    if (ids) ids.push(line.id);
    else entryIds.set(key, [line.id]);
    lineCount++;

    const cents = toCents(line.amount);
    if (cents < 0 && !category) untaggedSpentCents += -cents;
    if (cents < 0) {
      const magnitude = -cents;
      bump(spentCents, key, magnitude);
      totalSpentCents += magnitude;
      const month = line.date.slice(0, 7);
      let bucket = monthly.get(month);
      if (!bucket) {
        bucket = new Map();
        monthly.set(month, bucket);
      }
      bump(bucket, key, magnitude);
    } else {
      bump(receivedCents, key, cents);
      totalReceivedCents += cents;
    }
  }

  const totals: CategoryTotal[] = [...labels.keys()]
    .map(key => ({
      key,
      label: labels.get(key)!,
      spent: fromCents(spentCents.get(key) ?? 0),
      received: fromCents(receivedCents.get(key) ?? 0),
      count: counts.get(key) ?? 0,
      share:
        totalSpentCents === 0
          ? 0
          : (spentCents.get(key) ?? 0) / totalSpentCents,
      derived: derivedKeys.has(key),
      entryIds: entryIds.get(key) ?? [],
    }))
    .sort((a, b) => b.spent - a.spent || a.label.localeCompare(b.label));

  const months: CategoryMonth[] = monthsBetween(from, through).map(month => {
    const bucket = monthly.get(month);
    const spentByKey: Record<string, number> = {};
    let spent = 0;
    for (const [key, cents] of bucket ?? []) {
      spentByKey[key] = fromCents(cents);
      spent += cents;
    }
    return { month, spentByKey, spent: fromCents(spent) };
  });

  return {
    totals,
    months,
    totalSpent: fromCents(totalSpentCents),
    totalReceived: fromCents(totalReceivedCents),
    // Counted from the raw category, not the bins, so the headline stays
    // honest about the tagging gap even when name grouping splits it up.
    uncategorizedSpent: fromCents(untaggedSpentCents),
    lineCount,
  };
}

/**
 * The `limit` biggest spending categories, with everything past them folded
 * into one "Other" bin. Categorical palettes top out at eight slots, so the
 * tail is folded rather than handed generated hues.
 */
export function topCategories(
  totals: CategoryTotal[],
  limit: number
): CategoryTotal[] {
  const spending = totals.filter(total => total.spent > 0);
  if (spending.length <= limit) return spending;

  const head = spending.slice(0, limit);
  const tail = spending.slice(limit);
  // Summed through cents so the folded bin cannot accumulate float drift.
  const folded: CategoryTotal = {
    key: OTHER_KEY,
    label: OTHER_LABEL,
    spent: fromCents(tail.reduce((sum, t) => sum + toCents(t.spent), 0)),
    received: fromCents(tail.reduce((sum, t) => sum + toCents(t.received), 0)),
    count: tail.reduce((sum, t) => sum + t.count, 0),
    share: tail.reduce((sum, t) => sum + t.share, 0),
    derived: false,
    entryIds: tail.flatMap(t => t.entryIds),
  };
  return [...head, folded];
}

export interface CategorySeries {
  key: string;
  label: string;
  /** One value per month, aligned to the `months` array passed in. */
  values: number[];
}

/**
 * Reshapes monthly buckets into one stacked series per category.
 *
 * The folded "Other" bin has no key in `spentByKey`, so its monthly value is
 * derived as the month's total minus the named categories. That keeps each
 * stack summing to the month total instead of silently dropping the tail.
 */
export function monthlySeries(
  months: CategoryMonth[],
  series: CategoryTotal[]
): CategorySeries[] {
  const namedKeys = series
    .filter(entry => entry.key !== OTHER_KEY)
    .map(entry => entry.key);

  return series.map(entry => ({
    key: entry.key,
    label: entry.label,
    values: months.map(month => {
      if (entry.key !== OTHER_KEY) return month.spentByKey[entry.key] ?? 0;
      const named = namedKeys.reduce(
        (sum, key) => sum + toCents(month.spentByKey[key] ?? 0),
        0
      );
      return fromCents(Math.max(0, toCents(month.spent) - named));
    }),
  }));
}
