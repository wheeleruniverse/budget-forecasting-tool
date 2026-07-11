import type { BudgetMeta } from '@/types';

/**
 * Money helpers. Config JSON stores human-friendly dollar amounts; all
 * arithmetic happens in integer cents to avoid floating point drift.
 */

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function createMoneyFormatter(currency = 'USD'): (n: number) => string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  });
  return (n: number) => formatter.format(n);
}

export function resolveBaseCurrency(meta: BudgetMeta): string {
  return meta.baseCurrency ?? meta.currency ?? 'USD';
}

/** Units of base currency per 1 unit of the given currency. */
export function fxRate(meta: BudgetMeta, currency: string): number {
  if (currency === resolveBaseCurrency(meta)) return 1;
  return meta.fxRates?.[currency] ?? 1;
}

/** Converts between currencies through the base, rounded to cents. */
export function convertAmount(
  meta: BudgetMeta,
  amount: number,
  from: string,
  to: string
): number {
  if (from === to) return amount;
  return fromCents(
    Math.round((toCents(amount) * fxRate(meta, from)) / fxRate(meta, to))
  );
}
