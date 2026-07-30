import type {
  BudgetConfig,
  BudgetMeta,
  DaySnapshot,
  Entry,
  LedgerLine,
  MoneyMovement,
  Recurrence,
  Rule,
  RuleOverride,
} from '@/types';
import {
  addDays,
  addMonths,
  daysInMonth,
  parseDate,
  toDateString,
} from './dates';
import {
  convertAmount,
  fromCents,
  fxRate,
  resolveBaseCurrency,
  toCents,
} from './money';

/** Safety cap so a malformed recurrence can never loop forever. */
const MAX_OCCURRENCES = 5000;

/**
 * Overrides can move an occurrence to a different date, so rules are
 * expanded this far past the requested window and re-filtered by their
 * final date.
 */
const MOVE_PAD_DAYS = 366;

/** All original occurrence dates of a recurrence, from start through `through`. */
export function expandOccurrences(
  recurrence: Recurrence,
  through: string
): string[] {
  const { frequency, start, end } = recurrence;
  const last = end && end < through ? end : through;
  if (start > last) return [];

  const dates: string[] = [];
  const push = (date: string): boolean => {
    if (date > last) return false;
    if (date >= start) dates.push(date);
    return dates.length < MAX_OCCURRENCES;
  };

  if (
    frequency === 'daily' ||
    frequency === 'weekly' ||
    frequency === 'biweekly'
  ) {
    const step = frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 14;
    let date = start;
    while (push(date) && date <= last) {
      date = addDays(date, step);
      if (date > last) break;
    }
  } else if (frequency === 'semimonthly') {
    const days = [...(recurrence.days ?? [1, 15])].sort((a, b) => a - b);
    const { y, m } = parseDate(start);
    let cursor = { y, m };
    outer: for (let i = 0; i < MAX_OCCURRENCES; i++) {
      for (const day of days) {
        const clamped = Math.min(day, daysInMonth(cursor.y, cursor.m));
        const date = toDateString(cursor.y, cursor.m, clamped);
        if (date > last) break outer;
        if (!push(date)) break outer;
      }
      cursor =
        cursor.m === 12
          ? { y: cursor.y + 1, m: 1 }
          : { y: cursor.y, m: cursor.m + 1 };
    }
  } else {
    const stepMonths =
      frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12;
    const dayOfMonth = recurrence.dayOfMonth ?? parseDate(start).d;
    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      const date = addMonths(start, i * stepMonths, dayOfMonth);
      if (date > last) break;
      if (!push(date)) break;
    }
  }

  return dates;
}

/** A movement is a transfer when it names both a source and destination account. */
export function isTransfer(movement: MoneyMovement): boolean {
  return !!movement.from && !!movement.to;
}

/** Currency context used to resolve cross-currency transfer legs. */
interface FxContext {
  meta: BudgetMeta;
  currencyOf: (accountId: string) => string;
}

function fxContext(config: BudgetConfig): FxContext {
  const base = resolveBaseCurrency(config.meta);
  const currencies = new Map(
    config.accounts.map(a => [a.id, a.currency ?? base])
  );
  return {
    meta: config.meta,
    currencyOf: accountId => currencies.get(accountId) ?? base,
  };
}

function movementToLines(
  movement: MoneyMovement,
  fx: FxContext,
  date: string,
  lineId: string,
  source: 'entry' | 'rule',
  extra: Partial<LedgerLine> = {}
): LedgerLine[] {
  const base = {
    date,
    name: movement.name,
    category: movement.category,
    source,
    ...extra,
  };
  if (isTransfer(movement)) {
    const amount = Math.abs(movement.amount);
    // The receiving leg is in the destination account's currency: an
    // explicit toAmount wins, otherwise convert through meta.fxRates.
    const received =
      movement.toAmount != null
        ? Math.abs(movement.toAmount)
        : convertAmount(
            fx.meta,
            amount,
            fx.currencyOf(movement.from!),
            fx.currencyOf(movement.to!)
          );
    return [
      {
        ...base,
        id: `${lineId}:from`,
        accountId: movement.from!,
        amount: -amount,
        transfer: true,
        counterAccountId: movement.to!,
      },
      {
        ...base,
        id: `${lineId}:to`,
        accountId: movement.to!,
        amount: received,
        transfer: true,
        counterAccountId: movement.from!,
      },
    ];
  }
  return [
    {
      ...base,
      id: lineId,
      accountId: movement.accountId ?? '',
      amount: movement.amount,
    },
  ];
}

function ruleLines(
  rule: Rule,
  fx: FxContext,
  overrides: RuleOverride[],
  through: string,
  forecastFrom?: string
): LedgerLine[] {
  const overrideMap = new Map<string, RuleOverride>();
  for (const o of overrides) {
    if (o.ruleId === rule.id) overrideMap.set(o.date, o);
  }

  const lines: LedgerLine[] = [];
  for (const originalDate of expandOccurrences(rule.recurrence, through)) {
    const override = overrideMap.get(originalDate);
    if (override?.skip) continue;

    const date = override?.moveTo ?? originalDate;
    if (forecastFrom && date < forecastFrom) continue;
    const movement: MoneyMovement = {
      ...rule,
      name: override?.name ?? rule.name,
      amount: override?.amount ?? rule.amount,
      toAmount: override?.toAmount ?? rule.toAmount,
    };
    lines.push(
      ...movementToLines(
        movement,
        fx,
        date,
        `${rule.id}@${originalDate}`,
        'rule',
        {
          ruleId: rule.id,
          originalDate,
          overridden: !!override,
        }
      )
    );
  }
  return lines;
}

/** Every ledger line (entries + expanded rules) with a final date in [from, through]. */
export function buildLines(
  config: BudgetConfig,
  from: string,
  through: string
): LedgerLine[] {
  const lines: LedgerLine[] = [];
  const fx = fxContext(config);

  for (const entry of config.entries as Entry[]) {
    lines.push(...movementToLines(entry, fx, entry.date, entry.id, 'entry'));
  }
  const expandThrough = addDays(through, MOVE_PAD_DAYS);
  for (const rule of config.rules) {
    lines.push(
      ...ruleLines(
        rule,
        fx,
        config.overrides,
        expandThrough,
        config.meta.forecastFrom
      )
    );
  }

  return lines
    .filter(line => line.date >= from && line.date <= through)
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)
    );
}

/**
 * Builds one snapshot per day in [start, end], each carrying that day's
 * lines and the end-of-day balance of every account.
 *
 * Balances derive from each account's anchor (a known balance at the end
 * of a specific date): lines after the anchor accumulate forward, and
 * lines on or before it are subtracted to walk backward, so any date —
 * past or future — has a defined expected balance.
 */
export function buildLedger(
  config: BudgetConfig,
  start: string,
  end: string
): DaySnapshot[] {
  if (start > end) return [];

  // The computation span must reach every anchor so balances can be walked
  // from the anchor date out to the requested window.
  let spanStart = start;
  let spanEnd = end;
  for (const account of config.accounts) {
    if (account.anchor.date < spanStart) spanStart = account.anchor.date;
    if (account.anchor.date > spanEnd) spanEnd = account.anchor.date;
  }

  const lines = buildLines(config, addDays(spanStart, 1), spanEnd);

  // Signed cents per account per day.
  const dailySums = new Map<string, Map<string, number>>();
  for (const line of lines) {
    let byAccount = dailySums.get(line.date);
    if (!byAccount) {
      byAccount = new Map();
      dailySums.set(line.date, byAccount);
    }
    byAccount.set(
      line.accountId,
      (byAccount.get(line.accountId) ?? 0) + toCents(line.amount)
    );
  }
  const sumOn = (date: string, accountId: string): number =>
    dailySums.get(date)?.get(accountId) ?? 0;

  // End-of-day balance per account for every day in the span.
  const balancesByDate = new Map<string, Record<string, number>>();
  const allDates: string[] = [];
  for (let d = spanStart; d <= spanEnd; d = addDays(d, 1)) {
    allDates.push(d);
    balancesByDate.set(d, {});
  }

  for (const account of config.accounts) {
    const anchorCents = toCents(account.anchor.balance);
    const anchorIndex = allDates.indexOf(account.anchor.date);
    const cents = new Array<number>(allDates.length);
    cents[anchorIndex] = anchorCents;
    for (let i = anchorIndex + 1; i < allDates.length; i++) {
      cents[i] = cents[i - 1] + sumOn(allDates[i], account.id);
    }
    for (let i = anchorIndex - 1; i >= 0; i--) {
      cents[i] = cents[i + 1] - sumOn(allDates[i + 1], account.id);
    }
    allDates.forEach((date, i) => {
      balancesByDate.get(date)![account.id] = fromCents(cents[i]);
    });
  }

  const linesByDate = new Map<string, LedgerLine[]>();
  for (const line of lines) {
    const existing = linesByDate.get(line.date);
    if (existing) existing.push(line);
    else linesByDate.set(line.date, [line]);
  }

  // The all-accounts total is an estimate in the base currency: each
  // account's balance is converted through meta.fxRates before summing.
  const fx = fxContext(config);
  const totalOf = (balances: Record<string, number>): number =>
    fromCents(
      config.accounts.reduce(
        (sum, account) =>
          sum +
          Math.round(
            toCents(balances[account.id] ?? 0) *
              fxRate(config.meta, fx.currencyOf(account.id))
          ),
        0
      )
    );

  const snapshots: DaySnapshot[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const balances = balancesByDate.get(d) ?? {};
    snapshots.push({
      date: d,
      lines: linesByDate.get(d) ?? [],
      balances,
      total: totalOf(balances),
    });
  }
  return snapshots;
}

/** Expected end-of-day balances across all accounts on a single date. */
export function balancesOn(config: BudgetConfig, date: string): DaySnapshot {
  return buildLedger(config, date, date)[0];
}
