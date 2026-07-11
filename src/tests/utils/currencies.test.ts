import { currencyOptions } from '@/utils/currencies';
import { describe, expect, it } from 'vitest';

describe('currencyOptions', () => {
  it('lists ISO 4217 codes with readable labels', () => {
    const options = currencyOptions();
    const codes = options.map(o => o.code);
    expect(codes).toContain('EUR');
    expect(codes).toContain('USD');
    expect(options.find(o => o.code === 'EUR')?.label).toBe('EUR — Euro');
  });
});
