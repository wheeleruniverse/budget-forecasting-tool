import type { Account, Entry } from '@/types';
import { isValid, parse } from 'date-fns';
import { makeId } from './id';

/**
 * Converts a bank statement CSV export into one-time entries for a single
 * account the user picked. Rows are imported as-is: overlapping statements
 * create duplicates on purpose — they are counted so the UI can warn, and
 * the user deletes the ones they don't want.
 */
export interface StatementImportResult {
  entries: Entry[];
  /** Rows matching an existing entry on account, date, amount, and name. */
  duplicateCount: number;
  /** Rows (or the whole file) that could not be converted, with the reason. */
  problems: string[];
}

/** Splits CSV text into rows of fields, honoring quotes and CRLF. */
export function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(cells => cells.some(cell => cell.trim() !== ''));
}

/** Banks export with `,` or `;`; whichever dominates the header row wins. */
function detectDelimiter(text: string): string {
  const header = text.slice(0, text.indexOf('\n') + 1 || text.length);
  const commas = (header.match(/,/g) ?? []).length;
  const semicolons = (header.match(/;/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

/**
 * Parses a statement amount, accepting both decimal conventions:
 * "-24.99", "1,234.56" (dot decimal) and "-24,99", "1.234,56" (comma
 * decimal). Whichever separator appears last is the decimal one.
 */
export function parseStatementAmount(raw: string): number | null {
  let s = raw.trim().replace(/[^0-9.,+-]/g, '');
  if (s === '') return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Parses a date cell using the user-supplied date-fns format string (e.g. "yyyy-MM-dd", "dd-MM-yyyy"). */
function parseStatementDate(raw: string, format: string): string | null {
  const d = parse(raw.trim(), format, new Date());
  if (!isValid(d)) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function duplicateKey(entry: Entry): string {
  return [
    entry.accountId ?? '',
    entry.date,
    entry.amount.toFixed(2),
    entry.name.toLowerCase(),
  ].join('|');
}

/**
 * The user tells the importer what each field's column is called in their
 * file. Matching is case-insensitive but otherwise exact — no guessing.
 */
export interface StatementColumnMapping {
  date: string;
  /** date-fns format string for the date column (e.g. "yyyy-MM-dd", "dd-MM-yyyy"). */
  dateFormat: string;
  amount: string;
  /** Leave blank when the file has no name-like column. */
  name: string;
}

export const DEFAULT_COLUMN_MAPPING: StatementColumnMapping = {
  date: 'Date',
  dateFormat: 'yyyy-MM-dd',
  amount: 'Amount',
  name: 'Name',
};

/**
 * Converts statement CSV text into entries against the chosen account,
 * reading only the columns named in the mapping and ignoring all others.
 */
export function statementToEntries(
  csvText: string,
  accountId: string,
  existingEntries: Entry[],
  mapping: StatementColumnMapping = DEFAULT_COLUMN_MAPPING
): StatementImportResult {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return {
      entries: [],
      duplicateCount: 0,
      problems: ['The file has no data rows below the header.'],
    };
  }

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const columnIndex = (label: string): number =>
    headers.indexOf(label.trim().toLowerCase());

  const dateCol = columnIndex(mapping.date);
  const amountCol = columnIndex(mapping.amount);
  const nameCol = mapping.name.trim() === '' ? null : columnIndex(mapping.name);

  const missing = [
    ['Date', mapping.date, dateCol],
    ['Amount', mapping.amount, amountCol],
    ['Name', mapping.name, nameCol],
  ]
    .filter(([, , index]) => index === -1)
    .map(([field, label]) => `${field} column "${label}"`);
  if (missing.length > 0) {
    return {
      entries: [],
      duplicateCount: 0,
      problems: [
        `Not found in this file: ${missing.join(', ')}. ` +
          `Its columns are: ${rows[0].map(h => h.trim()).join(', ')}.`,
      ],
    };
  }

  const existingKeys = new Set(existingEntries.map(duplicateKey));
  const entries: Entry[] = [];
  const problems: string[] = [];
  let duplicateCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const date = parseStatementDate(cells[dateCol] ?? '', mapping.dateFormat);
    const amount = parseStatementAmount(cells[amountCol] ?? '');
    if (date === null || amount === null) {
      problems.push(
        `Row ${i + 1}: ${date === null ? `unreadable date "${cells[dateCol] ?? ''}"` : `unreadable amount "${cells[amountCol] ?? ''}"`}.`
      );
      continue;
    }
    const name =
      (nameCol === null ? '' : (cells[nameCol] ?? '').trim()) ||
      'Imported transaction';

    const entry: Entry = {
      id: makeId(name),
      name,
      amount,
      accountId,
      date,
    };
    if (existingKeys.has(duplicateKey(entry))) duplicateCount++;
    entries.push(entry);
  }

  return { entries, duplicateCount, problems };
}

// ─── Rule-based import ────────────────────────────────────────────────────────

/** Strips whitespace and uppercases for condition matching (handles IBANs, type codes, etc.). */
function normalizeConditionValue(s: string): string {
  return s.replace(/\s+/g, '').toUpperCase();
}

/** Returns true when all `when` conditions match the row, or when `when` is absent (catch-all). */
function matchesCondition(
  when: Record<string, string> | undefined,
  row: Record<string, string>
): boolean {
  if (!when) return true;
  return Object.entries(when).every(
    ([col, val]) =>
      normalizeConditionValue(row[col] ?? '') === normalizeConditionValue(val)
  );
}

/** Replaces ${ColumnName} tokens with values from the row. */
function interpolate(template: string, row: Record<string, string>): string {
  return template.replace(/\$\{([^}]+)\}/g, (_, col: string) => row[col] ?? '');
}

function applyShape(
  shape: Record<string, string>,
  row: Record<string, string>,
  dateFormat: string,
  fallbackAccountId: string,
  rowNum: number
): { entry: Entry } | { problem: string } {
  const val = (key: string): string => interpolate(shape[key] ?? '', row);

  const rawDate = val('date');
  const date = parseStatementDate(rawDate, dateFormat);
  if (!date) return { problem: `Row ${rowNum}: unreadable date "${rawDate}".` };

  const rawAmount = val('amount');
  const amount = parseStatementAmount(rawAmount);
  if (amount === null)
    return { problem: `Row ${rowNum}: unreadable amount "${rawAmount}".` };

  const to = shape.to ? val('to') : undefined;
  const name = val('name') || 'Imported transaction';
  const id = shape.id ? val('id').trim() || makeId(name) : makeId(name);
  const category = shape.category ? val('category') : undefined;

  let toAmount: number | undefined;
  if (shape.toAmount) {
    const parsed = parseStatementAmount(val('toAmount'));
    if (parsed !== null) toAmount = Math.abs(parsed);
  }

  const entry: Entry = {
    id,
    name,
    amount,
    date,
    ...(category ? { category } : {}),
    ...(to
      ? { from: fallbackAccountId, to }
      : { accountId: fallbackAccountId }),
    ...(toAmount !== undefined ? { toAmount } : {}),
  };

  return { entry };
}

/**
 * Rule-based import path: each CSV row is matched against the account's
 * import rules in order; the first matching rule's shape builds the entry.
 * Falls through to a "no matching rule" problem if none match.
 */
export function statementToEntriesWithRules(
  csvText: string,
  account: Account,
  existingEntries: Entry[]
): StatementImportResult {
  const importConfig = account.import!;
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return {
      entries: [],
      duplicateCount: 0,
      problems: ['The file has no data rows below the header.'],
    };
  }

  const headers = rows[0].map(h => h.trim());
  const toRowObj = (cells: string[]): Record<string, string> =>
    Object.fromEntries(headers.map((h, i) => [h, cells[i]?.trim() ?? '']));

  const dateFormat = importConfig.dateFormat ?? 'yyyy-MM-dd';
  const rules = importConfig.rules ?? [];
  const existingKeys = new Set(existingEntries.map(duplicateKey));
  const entries: Entry[] = [];
  const problems: string[] = [];
  let duplicateCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = toRowObj(rows[i]);
    const rule = rules.find(r => matchesCondition(r.when, row));
    if (!rule) {
      problems.push(`Row ${i + 1}: no matching import rule — skipped.`);
      continue;
    }

    if (rule.shape?.skip) continue;

    const result = applyShape(rule.shape!, row, dateFormat, account.id, i + 1);
    if ('problem' in result) {
      problems.push(result.problem);
      continue;
    }

    if (existingKeys.has(duplicateKey(result.entry))) duplicateCount++;
    entries.push(result.entry);
  }

  return { entries, duplicateCount, problems };
}
