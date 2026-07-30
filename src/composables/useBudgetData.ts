import type {
  Account,
  AppError,
  BudgetConfig,
  DataSource,
  DaySnapshot,
  Entry,
  Rule,
  RuleOverride,
} from '@/types';
import { addDays, fileTimestamp, today } from '@/utils/dates';
import { balancesOn, buildLedger } from '@/utils/ledger';
import {
  convertAmount,
  createMoneyFormatter,
  fromCents,
  resolveBaseCurrency,
  toCents,
} from '@/utils/money';
import {
  statementToEntries,
  statementToEntriesWithRules,
  type StatementColumnMapping,
} from '@/utils/statements';
import { normalizeBudgetConfig, validateBudgetConfig } from '@/utils/validate';
import { computed, readonly, ref, type Ref } from 'vue';

export interface StatementImportSummary {
  imported: number;
  duplicates: number;
  problems: string[];
}

const TEMPLATE_PATH = '/budget-template.json';
const WINDOW_BEFORE = 14;
const WINDOW_AFTER = 45;
const EXTEND_DAYS = 30;

// Singleton state — session only. Uploaded data lives in memory and is
// never persisted or sent anywhere; refresh the page and it is gone.
const config: Ref<BudgetConfig | null> = ref(null);
const source: Ref<DataSource> = ref('sample');
const fileName: Ref<string | null> = ref(null);
const loading = ref(false);
const error: Ref<AppError | null> = ref(null);
const dirty = ref(false);

const focusDate = ref(today());
const windowStart = ref(addDays(today(), -WINDOW_BEFORE));
const windowEnd = ref(addDays(today(), WINDOW_AFTER));

/** Active currency tab: an ISO code, or 'all' for the converted overview. */
const activeCurrency = ref<string>('all');

/** Accounts temporarily hidden from the ledger view (session only). */
const hiddenAccountIds = ref<Set<string>>(new Set());

function toggleAccountVisibility(accountId: string): void {
  const next = new Set(hiddenAccountIds.value);
  if (next.has(accountId)) next.delete(accountId);
  else next.add(accountId);
  hiddenAccountIds.value = next;
}

const formatterCache = new Map<string, (n: number) => string>();
function formatCurrency(currency: string): (n: number) => string {
  let formatter = formatterCache.get(currency);
  if (!formatter) {
    formatter = createMoneyFormatter(currency);
    formatterCache.set(currency, formatter);
  }
  return formatter;
}

/** Defaults the view to the first account's currency after a (re)load. */
function resetActiveCurrency(): void {
  const first = config.value?.accounts[0];
  activeCurrency.value =
    first?.currency ?? resolveBaseCurrency(config.value?.meta ?? { name: '' });
  hiddenAccountIds.value = new Set();
}

async function loadSample(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(TEMPLATE_PATH);
    if (!response.ok) {
      throw new Error(`Failed to load sample data: ${response.statusText}`);
    }
    config.value = normalizeBudgetConfig(await response.json());
    source.value = 'sample';
    fileName.value = null;
    dirty.value = false;
    resetActiveCurrency();
  } catch (err) {
    error.value = {
      message:
        err instanceof Error ? err.message : 'Failed to load sample data',
      details: err,
    };
  } finally {
    loading.value = false;
  }
}

async function importFile(file: File): Promise<boolean> {
  error.value = null;
  try {
    const parsed = JSON.parse(await file.text());
    const problems = validateBudgetConfig(parsed);
    if (problems.length > 0) {
      error.value = {
        message: `"${file.name}" is not a valid budget file.`,
        details: problems,
      };
      return false;
    }
    config.value = normalizeBudgetConfig(parsed);
    source.value = 'user';
    fileName.value = file.name;
    dirty.value = false;
    resetActiveCurrency();
    return true;
  } catch (err) {
    error.value = {
      message: `"${file.name}" is not valid JSON.`,
      details: err,
    };
    return false;
  }
}

/**
 * Imports a bank statement CSV as one-time entries on the chosen account.
 * Every readable row is added — duplicates included — and the summary
 * reports how many look like duplicates so the user can delete them.
 */
async function importStatement(
  file: File,
  accountId: string,
  mapping: StatementColumnMapping
): Promise<StatementImportSummary | null> {
  error.value = null;
  try {
    const text = await file.text();
    const account = config.value?.accounts.find(a => a.id === accountId);
    const result = account?.import?.rules?.length
      ? statementToEntriesWithRules(text, account, config.value?.entries ?? [])
      : statementToEntries(
          text,
          accountId,
          config.value?.entries ?? [],
          mapping
        );
    if (result.entries.length === 0) {
      error.value = {
        message: `"${file.name}" contained no importable rows.`,
        details: result.problems,
      };
      return null;
    }
    mutate(c => {
      c.entries.push(...result.entries);
      const latestDate = result.entries.reduce(
        (max, e) => (e.date > max ? e.date : max),
        ''
      );
      if (
        latestDate &&
        (!c.meta.forecastFrom || latestDate >= c.meta.forecastFrom)
      ) {
        c.meta.forecastFrom = addDays(latestDate, 1);
      }
    });
    return {
      imported: result.entries.length,
      duplicates: result.duplicateCount,
      problems: result.problems,
    };
  } catch (err) {
    error.value = {
      message: `Could not read "${file.name}".`,
      details: err,
    };
    return null;
  }
}

function downloadJson(data: unknown, name: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

// Filenames get a YYYYMMDD-HHMMSS prefix so repeated downloads never
// overwrite each other and every export doubles as a point-in-time backup.
function exportConfig(): void {
  if (!config.value) return;
  const slug = config.value.meta.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  downloadJson(
    config.value,
    `${fileTimestamp()}-${slug || 'budget'}.budget.json`
  );
  dirty.value = false;
}

async function downloadTemplate(): Promise<void> {
  const response = await fetch(TEMPLATE_PATH);
  downloadJson(
    await response.json(),
    `${fileTimestamp()}-budget-template.json`
  );
}

function clearError(): void {
  error.value = null;
}

function setFocusDate(date: string): void {
  focusDate.value = date;
  // Recenter the window when the focus jumps outside of it.
  if (date < windowStart.value || date > windowEnd.value) {
    windowStart.value = addDays(date, -WINDOW_BEFORE);
    windowEnd.value = addDays(date, WINDOW_AFTER);
  }
}

function extendBack(): void {
  windowStart.value = addDays(windowStart.value, -EXTEND_DAYS);
}

function extendForward(): void {
  windowEnd.value = addDays(windowEnd.value, EXTEND_DAYS);
}

// Undo for the extend buttons: steps the window back in, never shrinking
// past the default view around the focus date.
const canShrinkBack = computed(
  () => windowStart.value < addDays(focusDate.value, -WINDOW_BEFORE)
);
const canShrinkForward = computed(
  () => windowEnd.value > addDays(focusDate.value, WINDOW_AFTER)
);

function shrinkBack(): void {
  const floor = addDays(focusDate.value, -WINDOW_BEFORE);
  const next = addDays(windowStart.value, EXTEND_DAYS);
  windowStart.value = next > floor ? floor : next;
}

function shrinkForward(): void {
  const ceiling = addDays(focusDate.value, WINDOW_AFTER);
  const next = addDays(windowEnd.value, -EXTEND_DAYS);
  windowEnd.value = next < ceiling ? ceiling : next;
}

function mutate(fn: (c: BudgetConfig) => void): void {
  if (!config.value) return;
  fn(config.value);
  dirty.value = true;
}

function upsertAccount(account: Account): void {
  mutate(c => {
    const index = c.accounts.findIndex(a => a.id === account.id);
    if (index >= 0) {
      const oldAnchorDate = c.accounts[index].anchor.date;
      c.accounts[index] = account;
      // When the anchor advances, one-time entries on or before the new anchor
      // date are already reflected in the recorded balance and are irrelevant.
      if (account.anchor.date > oldAnchorDate) {
        c.entries = c.entries.filter(
          e => !(e.accountId === account.id && e.date <= account.anchor.date)
        );
      }
    } else {
      c.accounts.push(account);
    }
  });
}

function removeAccount(accountId: string): string | null {
  if (!config.value) return null;
  const referenced = [...config.value.rules, ...config.value.entries].some(
    m => m.accountId === accountId || m.from === accountId || m.to === accountId
  );
  if (referenced) {
    return 'This account is referenced by rules or entries. Remove those first.';
  }
  mutate(c => {
    c.accounts = c.accounts.filter(a => a.id !== accountId);
  });
  return null;
}

function upsertRule(rule: Rule): void {
  mutate(c => {
    const index = c.rules.findIndex(r => r.id === rule.id);
    if (index >= 0) c.rules[index] = rule;
    else c.rules.push(rule);
  });
}

function removeRule(ruleId: string): void {
  mutate(c => {
    c.rules = c.rules.filter(r => r.id !== ruleId);
    c.overrides = c.overrides.filter(o => o.ruleId !== ruleId);
  });
}

function upsertEntry(entry: Entry): void {
  mutate(c => {
    const index = c.entries.findIndex(e => e.id === entry.id);
    if (index >= 0) c.entries[index] = entry;
    else c.entries.push(entry);
  });
}

function removeEntry(entryId: string): void {
  mutate(c => {
    c.entries = c.entries.filter(e => e.id !== entryId);
  });
}

function setOverride(override: RuleOverride): void {
  mutate(c => {
    const index = c.overrides.findIndex(
      o => o.ruleId === override.ruleId && o.date === override.date
    );
    if (index >= 0) c.overrides[index] = override;
    else c.overrides.push(override);
  });
}

function removeOverride(ruleId: string, date: string): void {
  mutate(c => {
    c.overrides = c.overrides.filter(
      o => !(o.ruleId === ruleId && o.date === date)
    );
  });
}

export function useBudgetData() {
  // Auto-load the sample template on first use, mirroring the blog/portfolio
  // config pattern.
  if (!config.value && !loading.value) {
    loadSample();
  }

  const ledgerDays = computed(() => {
    if (!config.value) return [];
    return buildLedger(config.value, windowStart.value, windowEnd.value);
  });

  const focusSnapshot = computed(() => {
    if (!config.value) return null;
    return balancesOn(config.value, focusDate.value);
  });

  const accountsById = computed(() => {
    const map = new Map<string, Account>();
    for (const account of config.value?.accounts ?? []) {
      map.set(account.id, account);
    }
    return map;
  });

  const baseCurrency = computed(() =>
    resolveBaseCurrency(config.value?.meta ?? { name: '' })
  );

  const currencyOfAccount = (accountId: string): string =>
    accountsById.value.get(accountId)?.currency ?? baseCurrency.value;

  /** Distinct account currencies, in first-appearance order. */
  const currencies = computed(() => {
    const seen: string[] = [];
    for (const account of config.value?.accounts ?? []) {
      const currency = account.currency ?? baseCurrency.value;
      if (!seen.includes(currency)) seen.push(currency);
    }
    return seen;
  });

  /**
   * The converted "All" tab only appears when it can be honest: multiple
   * currencies, each convertible through meta.fxRates.
   */
  const showAllTab = computed(() => {
    if (currencies.value.length <= 1) return false;
    const rates = config.value?.meta.fxRates ?? {};
    return currencies.value.every(
      currency => currency === baseCurrency.value || (rates[currency] ?? 0) > 0
    );
  });

  /** All accounts belonging to the active tab, before show/hide filtering. */
  const tabAccounts = computed(() => {
    const accounts = config.value?.accounts ?? [];
    if (activeCurrency.value === 'all') return accounts;
    return accounts.filter(
      account =>
        (account.currency ?? baseCurrency.value) === activeCurrency.value
    );
  });

  const visibleAccounts = computed(() =>
    tabAccounts.value.filter(account => !hiddenAccountIds.value.has(account.id))
  );

  function setActiveCurrency(currency: string): void {
    activeCurrency.value = currency;
  }

  /** Converts an account's balance to the base currency via meta.fxRates. */
  const toBase = (accountId: string, amount: number): number =>
    config.value
      ? convertAmount(
          config.value.meta,
          amount,
          currencyOfAccount(accountId),
          baseCurrency.value
        )
      : amount;

  /**
   * The total for the active tab, over visible accounts only: an exact
   * same-currency sum on a currency tab, or the base-converted estimate
   * on the "All" tab.
   */
  const totalFor = (day: DaySnapshot): number =>
    fromCents(
      visibleAccounts.value.reduce((sum, account) => {
        const balance = day.balances[account.id] ?? 0;
        const counted =
          activeCurrency.value === 'all'
            ? toBase(account.id, balance)
            : balance;
        return sum + toCents(counted);
      }, 0)
    );

  const formatMoney = computed(() =>
    formatCurrency(
      activeCurrency.value === 'all' ? baseCurrency.value : activeCurrency.value
    )
  );

  const formatForAccount = (accountId: string): ((n: number) => string) =>
    formatCurrency(currencyOfAccount(accountId));

  /**
   * Balances before the earliest visible anchor are extrapolations of data
   * the user never recorded, so the ledger stops extending there.
   */
  const earliestAnchorDate = computed(() => {
    const anchors = visibleAccounts.value.map(a => a.anchor.date);
    return anchors.length ? anchors.reduce((m, d) => (d < m ? d : m)) : null;
  });

  const canExtendBack = computed(
    () =>
      earliestAnchorDate.value === null ||
      windowStart.value > earliestAnchorDate.value
  );

  return {
    config,
    source: readonly(source),
    fileName: readonly(fileName),
    loading: readonly(loading),
    error: readonly(error),
    dirty: readonly(dirty),
    focusDate: readonly(focusDate),
    windowStart: readonly(windowStart),
    windowEnd: readonly(windowEnd),
    ledgerDays,
    focusSnapshot,
    accountsById,
    baseCurrency,
    currencies,
    activeCurrency: readonly(activeCurrency),
    setActiveCurrency,
    showAllTab,
    tabAccounts,
    visibleAccounts,
    hiddenAccountIds: readonly(hiddenAccountIds),
    toggleAccountVisibility,
    currencyOfAccount,
    toBase,
    totalFor,
    formatMoney,
    formatForAccount,
    formatCurrency,
    earliestAnchorDate,
    canExtendBack,
    canShrinkBack,
    canShrinkForward,
    loadSample,
    importFile,
    importStatement,
    exportConfig,
    downloadTemplate,
    clearError,
    setFocusDate,
    extendBack,
    extendForward,
    shrinkBack,
    shrinkForward,
    upsertAccount,
    removeAccount,
    upsertRule,
    removeRule,
    upsertEntry,
    removeEntry,
    setOverride,
    removeOverride,
  };
}
