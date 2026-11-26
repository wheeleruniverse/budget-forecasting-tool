import type { BudgetConfig, Entry, Rule } from '@/types';
import type { CategoryMonth, CategoryTotal } from '@/utils/categories';
import {
  categoryKey,
  monthlySeries,
  OTHER_LABEL,
  summarizeCategories,
  topCategories,
  UNCATEGORIZED_LABEL,
} from '@/utils/categories';
import { describe, expect, it } from 'vitest';

function configWith(entries: Entry[], rules: Rule[] = []): BudgetConfig {
  return {
    version: 1,
    meta: {
      name: 'Category Test',
      baseCurrency: 'USD',
      forecastFrom: '2026-01-01',
    },
    accounts: [
      {
        id: 'card',
        name: 'Card',
        type: 'credit',
        anchor: { date: '2026-01-01', balance: 0 },
        currency: 'USD',
      },
      {
        id: 'checking',
        name: 'Checking',
        type: 'checking',
        anchor: { date: '2026-01-01', balance: 5000 },
        currency: 'USD',
      },
    ],
    rules,
    entries,
    overrides: [],
  };
}

function debit(
  id: string,
  date: string,
  amount: number,
  category?: string,
  accountId = 'card',
  name = id
): Entry {
  return {
    id,
    name,
    date,
    amount: -Math.abs(amount),
    accountId,
    ...(category ? { category } : {}),
  };
}

const RANGE = ['2026-01-01', '2026-03-31'] as const;

describe('categoryKey', () => {
  it('casefolds, trims, and collapses inner whitespace', () => {
    expect(categoryKey('  Food  ')).toBe('food');
    expect(categoryKey('FOOD')).toBe('food');
    expect(categoryKey('eating   out')).toBe('eating out');
  });

  it('maps missing and blank categories to the same empty key', () => {
    expect(categoryKey(undefined)).toBe('');
    expect(categoryKey('   ')).toBe('');
  });
});

describe('summarizeCategories', () => {
  it('bins spending by category and ranks it descending', () => {
    const summary = summarizeCategories(
      configWith([
        debit('a', '2026-01-05', 10, 'food'),
        debit('b', '2026-01-06', 90, 'housing'),
        debit('c', '2026-02-05', 25, 'food'),
      ]),
      'card',
      ...RANGE
    );

    expect(summary.totals.map(t => [t.label, t.spent])).toEqual([
      ['housing', 90],
      ['food', 35],
    ]);
    expect(summary.totalSpent).toBe(125);
    expect(summary.totals[0].share).toBeCloseTo(0.72, 5);
  });

  it('bins spellings of one category together under the first seen', () => {
    const summary = summarizeCategories(
      configWith([
        debit('a', '2026-01-05', 10, 'Food'),
        debit('b', '2026-01-06', 5, 'food '),
        debit('c', '2026-01-07', 5, 'FOOD'),
      ]),
      'card',
      ...RANGE
    );

    expect(summary.totals).toHaveLength(1);
    expect(summary.totals[0].label).toBe('Food');
    expect(summary.totals[0].spent).toBe(20);
    expect(summary.totals[0].count).toBe(3);
  });

  it('lumps untagged lines together when name grouping is off', () => {
    const summary = summarizeCategories(
      configWith([
        debit('a', '2026-01-05', 10, 'food'),
        debit('b', '2026-01-06', 40),
      ]),
      'card',
      ...RANGE,
      { groupUntaggedByName: false }
    );

    expect(summary.uncategorizedSpent).toBe(40);
    expect(summary.totals[0].label).toBe(UNCATEGORIZED_LABEL);
    expect(summary.totals[0].derived).toBe(false);
  });

  it('bins untagged lines by name by default, flagged as derived', () => {
    const summary = summarizeCategories(
      configWith([
        debit('e1', '2026-01-05', 4, undefined, 'card', 'COFFEE RUN'),
        debit('e2', '2026-01-12', 6, undefined, 'card', 'coffee   run'),
        debit('e3', '2026-01-06', 40, undefined, 'card', 'Rent'),
      ]),
      'card',
      ...RANGE
    );

    // The two coffee spellings normalize into one bin under the first seen.
    expect(summary.totals.map(t => [t.label, t.spent, t.derived])).toEqual([
      ['Rent', 40, true],
      ['COFFEE RUN', 10, true],
    ]);
    // The headline still reports the whole tagging gap, not the biggest bin.
    expect(summary.uncategorizedSpent).toBe(50);
  });

  it('keeps a real category separate from a name that matches it', () => {
    const summary = summarizeCategories(
      configWith([
        debit('e1', '2026-01-05', 10, undefined, 'card', 'food'),
        debit('e2', '2026-01-06', 25, 'food', 'card', 'Groceries'),
      ]),
      'card',
      ...RANGE
    );

    expect(summary.totals).toHaveLength(2);
    expect(summary.totals.map(t => t.derived).sort()).toEqual([false, true]);
  });

  it('carries the entry ids of each bin for bulk retagging', () => {
    const summary = summarizeCategories(
      configWith([
        debit('e1', '2026-01-05', 10, undefined, 'card', 'Shop'),
        debit('e2', '2026-01-09', 15, undefined, 'card', 'Shop'),
        debit('e3', '2026-01-06', 25, 'food', 'card', 'Groceries'),
      ]),
      'card',
      ...RANGE
    );

    expect(summary.totals.find(t => t.label === 'Shop')?.entryIds).toEqual([
      'e1',
      'e2',
    ]);
    expect(summary.totals.find(t => t.label === 'food')?.entryIds).toEqual([
      'e3',
    ]);
  });

  it('excludes transfers, which carry one category across both legs', () => {
    const summary = summarizeCategories(
      configWith([
        debit('spend', '2026-01-05', 10, 'food'),
        {
          id: 'payment',
          name: 'Card payment',
          date: '2026-01-20',
          amount: 500,
          category: 'transfer',
          from: 'checking',
          to: 'card',
        },
      ]),
      'card',
      ...RANGE
    );

    expect(summary.totals.map(t => t.label)).toEqual(['food']);
    expect(summary.lineCount).toBe(1);
    expect(summary.totalReceived).toBe(0);
  });

  it('excludes rule-generated forecast lines', () => {
    const summary = summarizeCategories(
      configWith(
        [debit('real', '2026-01-05', 10, 'food')],
        [
          {
            id: 'sub',
            name: 'Subscription',
            amount: -20,
            category: 'software',
            accountId: 'card',
            recurrence: { frequency: 'monthly', start: '2026-01-10' },
          },
        ]
      ),
      'card',
      ...RANGE
    );

    expect(summary.totals.map(t => t.label)).toEqual(['food']);
    expect(summary.totalSpent).toBe(10);
  });

  it('keeps other accounts out of the account being viewed', () => {
    const summary = summarizeCategories(
      configWith([
        debit('mine', '2026-01-05', 10, 'food'),
        debit('theirs', '2026-01-06', 999, 'food', 'checking'),
      ]),
      'card',
      ...RANGE
    );

    expect(summary.totalSpent).toBe(10);
  });

  it('separates income from spending within one category', () => {
    const summary = summarizeCategories(
      configWith([
        debit('spend', '2026-01-05', 30, 'food'),
        {
          id: 'refund',
          name: 'Refund',
          date: '2026-01-09',
          amount: 12,
          category: 'food',
          accountId: 'card',
        },
      ]),
      'card',
      ...RANGE
    );

    expect(summary.totals[0]).toMatchObject({
      label: 'food',
      spent: 30,
      received: 12,
      count: 2,
    });
    expect(summary.totalSpent).toBe(30);
    expect(summary.totalReceived).toBe(12);
  });

  it('emits every month in range, including ones with no spending', () => {
    const summary = summarizeCategories(
      configWith([
        debit('a', '2026-01-05', 10, 'food'),
        debit('b', '2026-03-05', 20, 'food'),
      ]),
      'card',
      ...RANGE
    );

    expect(summary.months.map(m => m.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
    expect(summary.months.map(m => m.spent)).toEqual([10, 0, 20]);
    // Monthly keys carry the same origin prefix as the bin keys.
    expect(summary.months[0].spentByKey).toEqual({ 'c:food': 10 });
  });

  it('returns empty totals when the account has nothing in range', () => {
    const summary = summarizeCategories(
      configWith([debit('a', '2025-06-05', 10, 'food')]),
      'card',
      ...RANGE
    );

    expect(summary.totals).toEqual([]);
    expect(summary.totalSpent).toBe(0);
    expect(summary.months).toHaveLength(3);
  });
});

/** Builds a CategoryTotal without restating the fields a test doesn't care about. */
function total(
  key: string,
  spent: number,
  share: number,
  extra: Partial<CategoryTotal> = {}
): CategoryTotal {
  return {
    key,
    label: key,
    spent,
    received: 0,
    count: 1,
    share,
    derived: false,
    entryIds: [`${key}-1`],
    ...extra,
  };
}

describe('topCategories', () => {
  const totals = [
    total('a', 50, 0.5),
    total('b', 30, 0.3),
    total('c', 12, 0.12),
    total('d', 8, 0.08, { received: 2 }),
  ];

  it('folds the tail past the limit into one Other bin', () => {
    const top = topCategories(totals, 2);

    expect(top.map(t => t.label)).toEqual(['a', 'b', OTHER_LABEL]);
    expect(top[2]).toMatchObject({ spent: 20, received: 2, count: 2 });
    expect(top[2].share).toBeCloseTo(0.2, 5);
  });

  it('leaves the list alone when it already fits', () => {
    expect(topCategories(totals, 10)).toHaveLength(4);
  });

  it('drops income-only categories, which have nothing to plot', () => {
    const withIncome = [...totals, total('pay', 0, 0, { received: 900 })];

    expect(topCategories(withIncome, 10).map(t => t.label)).not.toContain(
      'pay'
    );
  });

  it('keeps every folded entry id reachable on the Other bin', () => {
    expect(topCategories(totals, 2)[2].entryIds).toEqual(['c-1', 'd-1']);
  });
});

describe('monthlySeries', () => {
  const months: CategoryMonth[] = [
    { month: '2026-01', spentByKey: { food: 10, fun: 4 }, spent: 20 },
    { month: '2026-02', spentByKey: { food: 30 }, spent: 30 },
  ];

  it('aligns each named category to the month array, zero-filling gaps', () => {
    const series = monthlySeries(months, [total('food', 40, 1)]);

    expect(series).toEqual([{ key: 'food', label: 'food', values: [10, 30] }]);
  });

  it('derives Other from the month total so stacks still sum to it', () => {
    const series = monthlySeries(
      months,
      topCategories(
        [total('food', 40, 0.8), total('fun', 4, 0.08), total('gas', 6, 0.12)],
        1
      )
    );

    // January: 20 total - 10 food = 10 of untracked tail (fun 4 + gas 6).
    expect(series.map(s => [s.label, s.values])).toEqual([
      ['food', [10, 30]],
      [OTHER_LABEL, [10, 0]],
    ]);
    expect(series[0].values[0] + series[1].values[0]).toBe(months[0].spent);
  });
});
