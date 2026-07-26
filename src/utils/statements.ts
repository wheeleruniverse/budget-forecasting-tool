import type { Entry } from '@/types';
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
