export type AccountType =
  'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'other';

/**
 * One rule in an account's import config. Rows are matched in order;
 * the first matching rule's shape is used to build the entry.
 */
export interface ImportRule {
  /** Column→value conditions. All must match (whitespace-stripped, uppercased). Absent = catch-all. */
  when?: Record<string, string>;
  /** Template for the entry. String values may use ${ColumnName} interpolation. */
  shape: Record<string, string>;
}

export interface AccountImportConfig {
  /** date-fns format string applied to date columns in shapes (default: yyyy-MM-dd). */
  dateFormat?: string;
  /** Column name for the date field — used by the simple (no-rules) path. */
  dateColumn?: string;
  /** Column name for the amount field — used by the simple (no-rules) path. */
  amountColumn?: string;
  /** Column name for the name/description field — used by the simple (no-rules) path. */
  nameColumn?: string;
  /** Rule-based import: rows are matched in order, first match wins. */
  rules?: ImportRule[];
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** Known balance at the END of the given date. All other days are derived. */
  anchor: {
    date: string;
    balance: number;
  };
  /** ISO 4217 code (e.g. "EUR"). Defaults to the budget's base currency. */
  currency?: string;
  /** Optional hex color used for chart lines and labels. */
  color?: string;
  /** IBAN for this account — used for cross-account matching in import rules. */
  iban?: string;
  /** Per-account CSV import configuration. */
  import?: AccountImportConfig;
}

export type Frequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'semimonthly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

export interface Recurrence {
  frequency: Frequency;
  /** First occurrence date (YYYY-MM-DD). Also the anchor for weekly/biweekly cycles. */
  start: string;
  /** Optional inclusive last date. Omit for endless. */
  end?: string;
  /** monthly/quarterly/yearly: day of month, or 'last'. Defaults to the day from start. */
  dayOfMonth?: number | 'last';
  /** semimonthly only: the two days of each month. Defaults to [1, 15]. */
  days?: number[];
}

/**
 * A money movement affects either a single account (signed amount:
 * positive = credit, negative = debit) or is a transfer between two
 * accounts (positive amount, from -> to).
 */
export interface MoneyMovement {
  id: string;
  name: string;
  /** In the currency of the affected account (the `from` account for transfers). */
  amount: number;
  category?: string;
  accountId?: string;
  from?: string;
  to?: string;
  /**
   * Cross-currency transfers only: the positive amount received by the `to`
   * account, in its currency. Omit to convert via meta.fxRates.
   */
  toAmount?: number;
}

/** A recurring credit/debit/transfer, expanded into ledger lines on demand. */
export interface Rule extends MoneyMovement {
  recurrence: Recurrence;
}

/** A one-time credit/debit/transfer on a specific date (scheduled or recorded). */
export interface Entry extends MoneyMovement {
  date: string;
}

/** Adjusts a single occurrence of a rule without changing the rule itself. */
export interface RuleOverride {
  ruleId: string;
  /** The original occurrence date being overridden (YYYY-MM-DD). */
  date: string;
  skip?: boolean;
  amount?: number;
  /** Cross-currency transfer rules: replaces the received amount. */
  toAmount?: number;
  /** Move this occurrence to a different date. */
  moveTo?: string;
  name?: string;
}

export interface BudgetMeta {
  name: string;
  /** Legacy alias for baseCurrency; prefer baseCurrency. */
  currency?: string;
  /** ISO 4217 code all-accounts totals are reported in. Defaults to USD. */
  baseCurrency?: string;
  /**
   * User-supplied exchange rates: units of base currency per 1 unit of the
   * keyed currency (e.g. base EUR, { "USD": 0.92 }). No rates are ever
   * fetched — update these by hand when it matters.
   */
  fxRates?: Record<string, number>;
  /**
   * Rules only generate occurrences on or after this date (YYYY-MM-DD).
   * Occurrences before it are expected to exist as imported entries.
   * Automatically advances to the day after the latest imported entry date.
   * Omit to generate all rule occurrences (legacy behaviour).
   */
  forecastFrom?: string;
  description?: string;
}

export interface BudgetConfig {
  version: 1;
  meta: BudgetMeta;
  accounts: Account[];
  rules: Rule[];
  entries: Entry[];
  overrides: RuleOverride[];
}

/** A single credit or debit applied to one account on one date. */
export interface LedgerLine {
  id: string;
  date: string;
  name: string;
  accountId: string;
  /** Signed effect on this account. */
  amount: number;
  category?: string;
  source: 'entry' | 'rule';
  ruleId?: string;
  /** For rule lines: the original occurrence date, used to key overrides. */
  originalDate?: string;
  overridden?: boolean;
  transfer?: boolean;
  counterAccountId?: string;
}

/** One day in the ledger: its lines plus end-of-day balances per account. */
export interface DaySnapshot {
  date: string;
  lines: LedgerLine[];
  /** End-of-day balance per account id, each in its own currency. */
  balances: Record<string, number>;
  /** All accounts summed, converted to the base currency via meta.fxRates. */
  total: number;
}

export type DataSource = 'sample' | 'user';

export interface AppError {
  message: string;
  details?: unknown;
}
