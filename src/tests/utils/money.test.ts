import { convertAmount, fxRate, resolveBaseCurrency } from '@/utils/money';
import { describe, expect, it } from 'vitest';

const meta = {
  name: 'Test',
  baseCurrency: 'EUR',
  fxRates: { USD: 0.92 },
};

describe('resolveBaseCurrency', () => {
  it('prefers baseCurrency, falls back to legacy currency, then USD', () => {
    expect(resolveBaseCurrency(meta)).toBe('EUR');
    expect(resolveBaseCurrency({ name: 'x', currency: 'GBP' })).toBe('GBP');
    expect(resolveBaseCurrency({ name: 'x' })).toBe('USD');
  });
});

describe('fxRate', () => {
  it('is 1 for the base currency and reads fxRates otherwise', () => {
    expect(fxRate(meta, 'EUR')).toBe(1);
    expect(fxRate(meta, 'USD')).toBe(0.92);
  });
});

describe('convertAmount', () => {
  it('converts through the base currency, rounded to cents', () => {
    expect(convertAmount(meta, 100, 'USD', 'EUR')).toBe(92);
    expect(convertAmount(meta, 92, 'EUR', 'USD')).toBe(100);
    expect(convertAmount(meta, 100, 'EUR', 'EUR')).toBe(100);
  });
});
