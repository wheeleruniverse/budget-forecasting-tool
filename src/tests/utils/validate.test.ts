import { validateBudgetConfig } from '@/utils/validate';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const valid = {
  version: 1,
  meta: { name: 'Test' },
  accounts: [
    {
      id: 'checking',
      name: 'Checking',
      type: 'checking',
      anchor: { date: '2026-07-01', balance: 100 },
    },
  ],
  rules: [
    {
      id: 'rent',
      name: 'Rent',
      amount: -1000,
      accountId: 'checking',
      recurrence: { frequency: 'monthly', start: '2026-07-01' },
    },
  ],
  entries: [],
  overrides: [],
};

describe('validateBudgetConfig', () => {
  it('accepts a valid config', () => {
    expect(validateBudgetConfig(valid)).toEqual([]);
  });

  it('accepts the shipped sample template', () => {
    const raw = readFileSync(
      resolve(process.cwd(), 'public/budget-template.json'),
      'utf-8'
    );
    expect(validateBudgetConfig(JSON.parse(raw))).toEqual([]);
  });

  it('rejects non-object roots', () => {
    expect(validateBudgetConfig([])).toHaveLength(1);
    expect(validateBudgetConfig(null)).toHaveLength(1);
    expect(validateBudgetConfig('nope')).toHaveLength(1);
  });

  it('requires meta.name and accounts', () => {
    const errors = validateBudgetConfig({ accounts: [] });
    expect(errors.join(' ')).toContain('meta.name');
    expect(errors.join(' ')).toContain('accounts');
  });

  it('flags unknown account references', () => {
    const errors = validateBudgetConfig({
      ...valid,
      rules: [{ ...valid.rules[0], accountId: 'missing' }],
    });
    expect(errors.join(' ')).toContain('unknown account "missing"');
  });

  it('flags duplicate account ids', () => {
    const errors = validateBudgetConfig({
      ...valid,
      accounts: [valid.accounts[0], valid.accounts[0]],
    });
    expect(errors.join(' ')).toContain('duplicate account id');
  });

  it('flags invalid recurrence frequencies and dates', () => {
    const errors = validateBudgetConfig({
      ...valid,
      rules: [
        {
          ...valid.rules[0],
          recurrence: { frequency: 'fortnightly', start: 'soon' },
        },
      ],
    });
    expect(errors.join(' ')).toContain('frequency');
    expect(errors.join(' ')).toContain('recurrence.start');
  });

  it('flags invalid currency codes and fx rates', () => {
    const errors = validateBudgetConfig({
      ...valid,
      meta: { name: 'Test', baseCurrency: 'EURO', fxRates: { usd: -1 } },
    });
    expect(errors.join(' ')).toContain('baseCurrency');
    expect(errors.join(' ')).toContain('not a 3-letter ISO code');
    expect(errors.join(' ')).toContain('positive number');
  });

  it('requires toAmount or fxRates for cross-currency transfers', () => {
    const accounts = [
      { ...valid.accounts[0], id: 'eur-acct', currency: 'EUR' },
      { ...valid.accounts[0], id: 'usd-acct', currency: 'USD' },
    ];
    const transfer = {
      id: 'fx',
      name: 'FX transfer',
      date: '2026-07-10',
      amount: 100,
      from: 'usd-acct',
      to: 'eur-acct',
    };
    const bad = validateBudgetConfig({
      ...valid,
      meta: { name: 'Test', baseCurrency: 'EUR' },
      accounts,
      rules: [],
      entries: [transfer],
    });
    expect(bad.join(' ')).toContain('needs a toAmount or a meta.fxRates entry');

    const withToAmount = validateBudgetConfig({
      ...valid,
      meta: { name: 'Test', baseCurrency: 'EUR' },
      accounts,
      rules: [],
      entries: [{ ...transfer, toAmount: 92 }],
    });
    expect(withToAmount).toEqual([]);

    const withRates = validateBudgetConfig({
      ...valid,
      meta: { name: 'Test', baseCurrency: 'EUR', fxRates: { USD: 0.92 } },
      accounts,
      rules: [],
      entries: [transfer],
    });
    expect(withRates).toEqual([]);
  });

  it('flags overrides pointing at unknown rules', () => {
    const errors = validateBudgetConfig({
      ...valid,
      overrides: [{ ruleId: 'ghost', date: '2026-07-01', skip: true }],
    });
    expect(errors.join(' ')).toContain('unknown rule "ghost"');
  });
});
