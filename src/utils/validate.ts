import type { BudgetConfig, MoneyMovement } from '@/types';
import { isValidDate } from './dates';
import { isTransfer } from './ledger';
import { resolveBaseCurrency } from './money';

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

const FREQUENCIES = [
  'daily',
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
  'quarterly',
  'yearly',
];

/**
 * Validates an uploaded budget JSON before it replaces the active config.
 * Returns a list of human-readable problems; empty means valid.
 */
export function validateBudgetConfig(data: unknown): string[] {
  const errors: string[] = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['Root must be a JSON object matching the budget template.'];
  }
  const config = data as Partial<BudgetConfig>;

  if (!config.meta?.name) errors.push('meta.name is required.');
  if (!Array.isArray(config.accounts) || config.accounts.length === 0) {
    errors.push('accounts must be a non-empty array.');
    return errors;
  }

  const base = resolveBaseCurrency(config.meta ?? { name: '' });
  if (!CURRENCY_PATTERN.test(base)) {
    errors.push(
      `meta.baseCurrency must be a 3-letter ISO 4217 code (got "${base}").`
    );
  }
  Object.entries(config.meta?.fxRates ?? {}).forEach(([currency, rate]) => {
    if (!CURRENCY_PATTERN.test(currency)) {
      errors.push(`meta.fxRates: "${currency}" is not a 3-letter ISO code.`);
    }
    if (typeof rate !== 'number' || rate <= 0) {
      errors.push(`meta.fxRates.${currency} must be a positive number.`);
    }
  });

  const accountIds = new Set<string>();
  const currencyOf = new Map<string, string>();
  config.accounts.forEach((account, i) => {
    const label = `accounts[${i}]`;
    if (!account.id) errors.push(`${label}.id is required.`);
    else if (accountIds.has(account.id)) {
      errors.push(`${label}: duplicate account id "${account.id}".`);
    } else accountIds.add(account.id);
    if (!account.name) errors.push(`${label}.name is required.`);
    if (!account.anchor || typeof account.anchor.balance !== 'number') {
      errors.push(`${label}.anchor.balance must be a number.`);
    }
    if (!account.anchor?.date || !isValidDate(account.anchor.date)) {
      errors.push(`${label}.anchor.date must be a valid YYYY-MM-DD date.`);
    }
    if (account.currency && !CURRENCY_PATTERN.test(account.currency)) {
      errors.push(
        `${label}.currency must be a 3-letter ISO 4217 code (got "${account.currency}").`
      );
    }
    if (account.id) currencyOf.set(account.id, account.currency ?? base);
  });

  const hasRate = (currency: string): boolean =>
    currency === base || (config.meta?.fxRates?.[currency] ?? 0) > 0;

  const checkMovement = (movement: MoneyMovement, label: string): void => {
    if (!movement.id) errors.push(`${label}.id is required.`);
    if (!movement.name) errors.push(`${label}.name is required.`);
    if (typeof movement.amount !== 'number') {
      errors.push(`${label}.amount must be a number.`);
    }
    if (isTransfer(movement)) {
      if (!accountIds.has(movement.from!)) {
        errors.push(
          `${label}.from references unknown account "${movement.from}".`
        );
      }
      if (!accountIds.has(movement.to!)) {
        errors.push(`${label}.to references unknown account "${movement.to}".`);
      }
      if (movement.toAmount != null) {
        if (typeof movement.toAmount !== 'number' || movement.toAmount <= 0) {
          errors.push(`${label}.toAmount must be a positive number.`);
        }
      } else {
        // Without an explicit received amount, a cross-currency transfer
        // needs fxRates to derive the receiving leg.
        const fromCurrency = currencyOf.get(movement.from ?? '');
        const toCurrency = currencyOf.get(movement.to ?? '');
        if (fromCurrency && toCurrency && fromCurrency !== toCurrency) {
          for (const currency of [fromCurrency, toCurrency]) {
            if (!hasRate(currency)) {
              errors.push(
                `${label}: cross-currency transfer needs a toAmount or a meta.fxRates entry for "${currency}".`
              );
            }
          }
        }
      }
    } else if (!movement.accountId || !accountIds.has(movement.accountId)) {
      errors.push(
        `${label}.accountId references unknown account "${movement.accountId}".`
      );
    }
  };

  const ruleIds = new Set<string>();
  (config.rules ?? []).forEach((rule, i) => {
    const label = `rules[${i}]`;
    checkMovement(rule, label);
    if (rule.id) ruleIds.add(rule.id);
    if (!rule.recurrence) {
      errors.push(`${label}.recurrence is required.`);
      return;
    }
    if (!FREQUENCIES.includes(rule.recurrence.frequency)) {
      errors.push(
        `${label}.recurrence.frequency must be one of: ${FREQUENCIES.join(', ')}.`
      );
    }
    if (!rule.recurrence.start || !isValidDate(rule.recurrence.start)) {
      errors.push(`${label}.recurrence.start must be a valid YYYY-MM-DD date.`);
    }
    if (rule.recurrence.end && !isValidDate(rule.recurrence.end)) {
      errors.push(`${label}.recurrence.end must be a valid YYYY-MM-DD date.`);
    }
  });

  (config.entries ?? []).forEach((entry, i) => {
    const label = `entries[${i}]`;
    checkMovement(entry, label);
    if (!entry.date || !isValidDate(entry.date)) {
      errors.push(`${label}.date must be a valid YYYY-MM-DD date.`);
    }
  });

  (config.overrides ?? []).forEach((override, i) => {
    const label = `overrides[${i}]`;
    if (!override.ruleId || !ruleIds.has(override.ruleId)) {
      errors.push(
        `${label}.ruleId references unknown rule "${override.ruleId}".`
      );
    }
    if (!override.date || !isValidDate(override.date)) {
      errors.push(`${label}.date must be a valid YYYY-MM-DD date.`);
    }
    if (override.moveTo && !isValidDate(override.moveTo)) {
      errors.push(`${label}.moveTo must be a valid YYYY-MM-DD date.`);
    }
  });

  return errors;
}

/** Fills optional collections so the rest of the app can assume they exist. */
export function normalizeBudgetConfig(data: BudgetConfig): BudgetConfig {
  return {
    version: 1,
    meta: data.meta,
    accounts: data.accounts,
    rules: data.rules ?? [],
    entries: data.entries ?? [],
    overrides: data.overrides ?? [],
  };
}
