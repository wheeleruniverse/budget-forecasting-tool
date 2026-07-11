/**
 * ISO 4217 currency codes sourced from the runtime itself via
 * Intl.supportedValuesOf — no dependency, and always as current as the
 * browser. A small static list covers engines that predate the API.
 */

const FALLBACK_CODES = [
  'AUD',
  'BRL',
  'CAD',
  'CHF',
  'CNY',
  'EUR',
  'GBP',
  'INR',
  'JPY',
  'MXN',
  'NOK',
  'NZD',
  'SEK',
  'USD',
];

export interface CurrencyOption {
  code: string;
  label: string;
}

export function currencyOptions(): CurrencyOption[] {
  const codes =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('currency')
      : FALLBACK_CODES;

  const names = new Intl.DisplayNames(['en'], { type: 'currency' });
  return codes.map(code => {
    const name = names.of(code);
    return {
      code,
      label: name && name !== code ? `${code} — ${name}` : code,
    };
  });
}
