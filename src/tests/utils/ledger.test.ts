import type { BudgetConfig } from '@/types';
import {
  balancesOn,
  buildLedger,
  buildLines,
  expandOccurrences,
} from '@/utils/ledger';
import { describe, expect, it } from 'vitest';

function baseConfig(overrides: Partial<BudgetConfig> = {}): BudgetConfig {
  return {
    version: 1,
    meta: { name: 'Test', currency: 'USD' },
    accounts: [
      {
        id: 'checking',
        name: 'Checking',
        type: 'checking',
        anchor: { date: '2026-07-01', balance: 1000 },
      },
      {
        id: 'savings',
        name: 'Savings',
        type: 'savings',
        anchor: { date: '2026-07-01', balance: 5000 },
      },
    ],
    rules: [],
    entries: [],
    overrides: [],
    ...overrides,
  };
}

describe('expandOccurrences', () => {
  it('expands daily', () => {
    const dates = expandOccurrences(
      { frequency: 'daily', start: '2026-07-01' },
      '2026-07-03'
    );
    expect(dates).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
  });

  it('expands weekly and biweekly from the start anchor', () => {
    expect(
      expandOccurrences(
        { frequency: 'weekly', start: '2026-07-03' },
        '2026-07-20'
      )
    ).toEqual(['2026-07-03', '2026-07-10', '2026-07-17']);
    expect(
      expandOccurrences(
        { frequency: 'biweekly', start: '2026-07-03' },
        '2026-08-01'
      )
    ).toEqual(['2026-07-03', '2026-07-17', '2026-07-31']);
  });

  it('expands semimonthly with default days 1 and 15', () => {
    expect(
      expandOccurrences(
        { frequency: 'semimonthly', start: '2026-07-01' },
        '2026-08-20'
      )
    ).toEqual(['2026-07-01', '2026-07-15', '2026-08-01', '2026-08-15']);
  });

  it('expands monthly with day clamping', () => {
    expect(
      expandOccurrences(
        { frequency: 'monthly', start: '2026-01-31' },
        '2026-04-30'
      )
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('supports dayOfMonth "last"', () => {
    expect(
      expandOccurrences(
        {
          frequency: 'monthly',
          start: '2026-01-31',
          dayOfMonth: 'last',
        },
        '2026-03-31'
      )
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('respects the recurrence end date', () => {
    expect(
      expandOccurrences(
        { frequency: 'monthly', start: '2026-07-01', end: '2026-08-31' },
        '2026-12-31'
      )
    ).toEqual(['2026-07-01', '2026-08-01']);
  });

  it('expands quarterly and yearly', () => {
    expect(
      expandOccurrences(
        { frequency: 'quarterly', start: '2026-01-10' },
        '2026-12-31'
      )
    ).toEqual(['2026-01-10', '2026-04-10', '2026-07-10', '2026-10-10']);
    expect(
      expandOccurrences(
        { frequency: 'yearly', start: '2026-02-10' },
        '2028-12-31'
      )
    ).toEqual(['2026-02-10', '2027-02-10', '2028-02-10']);
  });
});

describe('buildLines', () => {
  it('applies skip overrides', () => {
    const config = baseConfig({
      rules: [
        {
          id: 'rent',
          name: 'Rent',
          amount: -1000,
          accountId: 'checking',
          recurrence: { frequency: 'monthly', start: '2026-07-01' },
        },
      ],
      overrides: [{ ruleId: 'rent', date: '2026-08-01', skip: true }],
    });
    const lines = buildLines(config, '2026-07-01', '2026-09-30');
    expect(lines.map(l => l.date)).toEqual(['2026-07-01', '2026-09-01']);
  });

  it('applies amount overrides and flags them', () => {
    const config = baseConfig({
      rules: [
        {
          id: 'utils',
          name: 'Utilities',
          amount: -200,
          accountId: 'checking',
          recurrence: { frequency: 'monthly', start: '2026-07-15' },
        },
      ],
      overrides: [{ ruleId: 'utils', date: '2026-07-15', amount: -310 }],
    });
    const [july, august] = buildLines(config, '2026-07-01', '2026-08-31');
    expect(july.amount).toBe(-310);
    expect(july.overridden).toBe(true);
    expect(august.amount).toBe(-200);
    expect(august.overridden).toBeFalsy();
  });

  it('moves an occurrence with moveTo, keyed by the original date', () => {
    const config = baseConfig({
      rules: [
        {
          id: 'pay',
          name: 'Paycheck',
          amount: 2000,
          accountId: 'checking',
          recurrence: { frequency: 'monthly', start: '2026-07-01' },
        },
      ],
      overrides: [{ ruleId: 'pay', date: '2026-08-01', moveTo: '2026-07-31' }],
    });
    const lines = buildLines(config, '2026-07-01', '2026-08-31');
    expect(lines.map(l => l.date)).toEqual(['2026-07-01', '2026-07-31']);
    expect(lines[1].originalDate).toBe('2026-08-01');
  });

  it('expands transfers into two linked legs', () => {
    const config = baseConfig({
      entries: [
        {
          id: 'sweep',
          name: 'Savings sweep',
          date: '2026-07-10',
          amount: 500,
          from: 'checking',
          to: 'savings',
        },
      ],
    });
    const lines = buildLines(config, '2026-07-01', '2026-07-31');
    expect(lines).toHaveLength(2);
    const fromLeg = lines.find(l => l.accountId === 'checking')!;
    const toLeg = lines.find(l => l.accountId === 'savings')!;
    expect(fromLeg.amount).toBe(-500);
    expect(toLeg.amount).toBe(500);
    expect(fromLeg.counterAccountId).toBe('savings');
    expect(toLeg.counterAccountId).toBe('checking');
  });
});

describe('multi-currency', () => {
  function fxConfig(overrides: Partial<BudgetConfig> = {}): BudgetConfig {
    return baseConfig({
      meta: { name: 'FX', baseCurrency: 'EUR', fxRates: { USD: 0.92 } },
      accounts: [
        {
          id: 'nl-bills',
          name: 'NL Bills',
          type: 'checking',
          currency: 'EUR',
          anchor: { date: '2026-07-01', balance: 1000 },
        },
        {
          id: 'us-checking',
          name: 'US Checking',
          type: 'checking',
          currency: 'USD',
          anchor: { date: '2026-07-01', balance: 500 },
        },
      ],
      ...overrides,
    });
  }

  it('uses an explicit toAmount for the receiving leg', () => {
    const config = fxConfig({
      entries: [
        {
          id: 'fx',
          name: 'USD → EUR',
          date: '2026-07-10',
          amount: 1500,
          from: 'us-checking',
          to: 'nl-bills',
          toAmount: 1372.5,
        },
      ],
    });
    const lines = buildLines(config, '2026-07-01', '2026-07-31');
    expect(lines.find(l => l.accountId === 'us-checking')!.amount).toBe(-1500);
    expect(lines.find(l => l.accountId === 'nl-bills')!.amount).toBe(1372.5);
  });

  it('converts via fxRates when toAmount is omitted', () => {
    const config = fxConfig({
      entries: [
        {
          id: 'fx',
          name: 'USD → EUR',
          date: '2026-07-10',
          amount: 100,
          from: 'us-checking',
          to: 'nl-bills',
        },
      ],
    });
    const lines = buildLines(config, '2026-07-01', '2026-07-31');
    expect(lines.find(l => l.accountId === 'nl-bills')!.amount).toBe(92);
  });

  it('reports the all-accounts total in the base currency', () => {
    const snapshot = balancesOn(fxConfig(), '2026-07-02');
    // EUR 1000 + USD 500 × 0.92 = EUR 1460.
    expect(snapshot.total).toBe(1460);
  });

  it('keeps per-account balances in their own currencies', () => {
    const config = fxConfig({
      entries: [
        {
          id: 'fx',
          name: 'USD → EUR',
          date: '2026-07-10',
          amount: 1500,
          from: 'us-checking',
          to: 'nl-bills',
          toAmount: 1372.5,
        },
      ],
    });
    const snapshot = balancesOn(config, '2026-07-11');
    expect(snapshot.balances['us-checking']).toBe(-1000);
    expect(snapshot.balances['nl-bills']).toBe(2372.5);
  });
});

describe('buildLedger balances', () => {
  it('projects forward from the anchor', () => {
    const config = baseConfig({
      rules: [
        {
          id: 'rent',
          name: 'Rent',
          amount: -1000,
          accountId: 'checking',
          recurrence: { frequency: 'monthly', start: '2026-07-05' },
        },
      ],
    });
    const days = buildLedger(config, '2026-07-04', '2026-07-06');
    expect(days.map(d => d.balances['checking'])).toEqual([1000, 0, 0]);
  });

  it('walks backward for dates before the anchor', () => {
    const config = baseConfig({
      entries: [
        {
          id: 'spent',
          name: 'Groceries',
          date: '2026-06-30',
          amount: -100,
          accountId: 'checking',
        },
      ],
    });
    // Anchor says EOD 2026-07-01 = 1000, so before the June 30 debit the
    // account must have held 1100.
    const days = buildLedger(config, '2026-06-29', '2026-07-01');
    expect(days.map(d => d.balances['checking'])).toEqual([1100, 1000, 1000]);
  });

  it('keeps the all-accounts total unchanged by transfers', () => {
    const config = baseConfig({
      entries: [
        {
          id: 'sweep',
          name: 'Sweep',
          date: '2026-07-10',
          amount: 500,
          from: 'checking',
          to: 'savings',
        },
      ],
    });
    const snapshot = balancesOn(config, '2026-07-11');
    expect(snapshot.balances['checking']).toBe(500);
    expect(snapshot.balances['savings']).toBe(5500);
    expect(snapshot.total).toBe(6000);
  });

  it('handles accounts with anchors on different dates', () => {
    const config = baseConfig({
      accounts: [
        {
          id: 'checking',
          name: 'Checking',
          type: 'checking',
          anchor: { date: '2026-07-01', balance: 1000 },
        },
        {
          id: 'savings',
          name: 'Savings',
          type: 'savings',
          anchor: { date: '2026-08-01', balance: 5000 },
        },
      ],
      entries: [
        {
          id: 'deposit',
          name: 'Deposit',
          date: '2026-07-15',
          amount: 200,
          accountId: 'savings',
        },
      ],
    });
    // Walking back from the August anchor across the July 15 deposit.
    const snapshot = balancesOn(config, '2026-07-10');
    expect(snapshot.balances['savings']).toBe(4800);
    expect(snapshot.balances['checking']).toBe(1000);
  });

  it('avoids floating point drift when summing cents', () => {
    const config = baseConfig({
      accounts: [
        {
          id: 'checking',
          name: 'Checking',
          type: 'checking',
          anchor: { date: '2026-07-01', balance: 0 },
        },
      ],
      rules: [
        {
          id: 'coffee',
          name: 'Coffee',
          amount: -0.1,
          accountId: 'checking',
          recurrence: { frequency: 'daily', start: '2026-07-02' },
        },
      ],
    });
    const snapshot = balancesOn(config, '2026-07-04');
    expect(snapshot.balances['checking']).toBe(-0.3);
  });

  it('attaches the day lines to each snapshot', () => {
    const config = baseConfig({
      entries: [
        {
          id: 'one',
          name: 'Thing',
          date: '2026-07-10',
          amount: -25,
          accountId: 'checking',
        },
      ],
    });
    const days = buildLedger(config, '2026-07-09', '2026-07-11');
    expect(days[0].lines).toHaveLength(0);
    expect(days[1].lines).toHaveLength(1);
    expect(days[1].lines[0].name).toBe('Thing');
  });
});
