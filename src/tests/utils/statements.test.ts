import type { Entry } from '@/types';
import {
  parseCsv,
  parseStatementAmount,
  statementToEntries,
} from '@/utils/statements';
import { describe, expect, it } from 'vitest';

// Mirrors the bunq export column layout with entirely made-up values.
const BUNQ_CSV = `"Date","Interest Date","Amount","Account","Counterparty","Name","Description"
"2026-01-05","2026-01-05","-12.34","NL00MOCK0000000000","","Corner Cafe 123","Corner Cafe 123 MOCKTOWN, NL"
"2026-01-11","2026-01-11","-56.78","NL00MOCK0000000000","","Pizza Palace Delivery","Pizza Palace Delivery Mockville, NL"
"2026-01-12","2026-01-12","-9.00","NL00MOCK0000000000","","Sample Snack Bar","Sample Snack Bar MOCKTOWN, NL"
`;

describe('parseCsv', () => {
  it('parses quoted fields containing the delimiter', () => {
    const rows = parseCsv('"a","b,c","d"\n"1","2","3"');
    expect(rows).toEqual([
      ['a', 'b,c', 'd'],
      ['1', '2', '3'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsv('"say ""hi""","x"')).toEqual([['say "hi"', 'x']]);
  });

  it('handles CRLF line endings and skips blank lines', () => {
    expect(parseCsv('a,b\r\n1,2\r\n\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('detects semicolon-delimited files', () => {
    expect(parseCsv('Date;Amount;Name\n2026-07-01;-5,00;Coffee')).toEqual([
      ['Date', 'Amount', 'Name'],
      ['2026-07-01', '-5,00', 'Coffee'],
    ]);
  });
});

describe('parseStatementAmount', () => {
  it('parses dot-decimal amounts with thousands commas', () => {
    expect(parseStatementAmount('-24.99')).toBe(-24.99);
    expect(parseStatementAmount('1,234.56')).toBe(1234.56);
  });

  it('parses comma-decimal amounts with thousands dots', () => {
    expect(parseStatementAmount('-24,99')).toBe(-24.99);
    expect(parseStatementAmount('1.234,56')).toBe(1234.56);
  });

  it('ignores currency symbols and rejects garbage', () => {
    expect(parseStatementAmount('€ -24.99')).toBe(-24.99);
    expect(parseStatementAmount('')).toBeNull();
    expect(parseStatementAmount('n/a')).toBeNull();
  });
});

describe('statementToEntries', () => {
  it('converts a bunq-style export into entries on the chosen account', () => {
    const result = statementToEntries(BUNQ_CSV, 'mock-spending', []);
    expect(result.problems).toEqual([]);
    expect(result.duplicateCount).toBe(0);
    expect(result.entries).toHaveLength(3);
    const [first] = result.entries;
    expect(first).toMatchObject({
      name: 'Corner Cafe 123',
      amount: -12.34,
      accountId: 'mock-spending',
      date: '2026-01-05',
    });
    expect(first.id).toBeTruthy();
  });

  it('assigns each entry a unique id', () => {
    const result = statementToEntries(BUNQ_CSV, 'acct', []);
    const ids = result.entries.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('labels rows with an empty name cell as "Imported transaction"', () => {
    const csv = `"Date","Amount","Name"
"2026-01-01","-5.00","Mock Grocer"
"2026-01-02","-6.00",""
`;
    const result = statementToEntries(csv, 'acct', []);
    expect(result.entries.map(e => e.name)).toEqual([
      'Mock Grocer',
      'Imported transaction',
    ]);
  });

  it('still imports duplicates but counts them', () => {
    const existing: Entry[] = [
      {
        id: 'corner-cafe-123-x1y2',
        name: 'Corner Cafe 123',
        amount: -12.34,
        accountId: 'mock-spending',
        date: '2026-01-05',
      },
    ];
    const result = statementToEntries(BUNQ_CSV, 'mock-spending', existing);
    expect(result.entries).toHaveLength(3);
    expect(result.duplicateCount).toBe(1);
  });

  it('does not count a match on a different account as a duplicate', () => {
    const existing: Entry[] = [
      {
        id: 'corner-cafe-123-x1y2',
        name: 'Corner Cafe 123',
        amount: -12.34,
        accountId: 'mock-other-account',
        date: '2026-01-05',
      },
    ];
    const result = statementToEntries(BUNQ_CSV, 'mock-spending', existing);
    expect(result.duplicateCount).toBe(0);
  });

  it('skips unreadable rows and reports them', () => {
    const csv = `"Date","Amount","Name"
"2026-07-01","-5.00","Good row"
"not a date","-5.00","Bad date"
"2026-07-03","??","Bad amount"
`;
    const result = statementToEntries(csv, 'acct', []);
    expect(result.entries).toHaveLength(1);
    expect(result.problems).toHaveLength(2);
    expect(result.problems[0]).toContain('Row 3');
    expect(result.problems[1]).toContain('Row 4');
  });

  it('rejects files with no data rows', () => {
    const result = statementToEntries('"Date","Amount"\n', 'acct', []);
    expect(result.entries).toEqual([]);
    expect(result.problems[0]).toContain('no data rows');
  });

  it('reads columns under the names the user mapped', () => {
    const csv = `"Transaction Date","Amount (EUR)","Payee"
"2026-01-01","-5.00","Mock Bakery"
`;
    const result = statementToEntries(csv, 'acct', [], {
      date: 'Transaction Date',
      dateFormat: 'yyyy-MM-dd',
      amount: 'Amount (EUR)',
      name: 'Payee',
    });
    expect(result.problems).toEqual([]);
    expect(result.entries).toEqual([
      expect.objectContaining({
        date: '2026-01-01',
        amount: -5,
        name: 'Mock Bakery',
      }),
    ]);
  });

  it('matches mapped names case-insensitively but never partially', () => {
    const csv = `"DATE","AMOUNT","NAME"
"2026-01-01","-5.00","Mock Cafe"
`;
    expect(statementToEntries(csv, 'acct', []).entries).toHaveLength(1);

    const partial = statementToEntries(
      `"Interest Date","Amount","Name"\n"2026-01-01","-5.00","Mock Cafe"\n`,
      'acct',
      []
    );
    expect(partial.entries).toEqual([]);
    expect(partial.problems[0]).toContain('Date column "Date"');
  });

  it('reports every missing mapped column and lists the file columns', () => {
    const result = statementToEntries(`"Foo","Bar"\n"1","2"\n`, 'acct', []);
    expect(result.entries).toEqual([]);
    expect(result.problems[0]).toContain('Date column "Date"');
    expect(result.problems[0]).toContain('Amount column "Amount"');
    expect(result.problems[0]).toContain('Name column "Name"');
    expect(result.problems[0]).toContain('Its columns are: Foo, Bar.');
  });

  it('ignores any number of unexpected columns', () => {
    const extras = Array.from({ length: 40 }, (_, i) => `Extra ${i}`);
    const header = ['Date', ...extras, 'Amount', 'Name']
      .map(h => `"${h}"`)
      .join(',');
    const row = ['2026-01-01', ...extras.map(() => 'noise'), '-5.00', 'Mock']
      .map(v => `"${v}"`)
      .join(',');
    const result = statementToEntries(`${header}\n${row}\n`, 'acct', []);
    expect(result.problems).toEqual([]);
    expect(result.entries).toEqual([
      expect.objectContaining({
        date: '2026-01-01',
        amount: -5,
        name: 'Mock',
      }),
    ]);
  });

  it('imports a Date,Amount file when the name mapping is left blank', () => {
    const csv = `"Date","Amount"
"2026-01-01","-5.00"
`;
    const result = statementToEntries(csv, 'acct', [], {
      date: 'Date',
      dateFormat: 'yyyy-MM-dd',
      amount: 'Amount',
      name: '',
    });
    expect(result.problems).toEqual([]);
    expect(result.entries).toEqual([
      expect.objectContaining({ name: 'Imported transaction', amount: -5 }),
    ]);
  });

  it('parses DD-MM-YYYY dates (e.g. Wise exports)', () => {
    const csv = `"Date","Amount","Name"
"05-07-2026","-12.00","Wise transfer"
`;
    const result = statementToEntries(csv, 'acct', [], {
      date: 'Date',
      dateFormat: 'dd-MM-yyyy',
      amount: 'Amount',
      name: 'Name',
    });
    expect(result.problems).toEqual([]);
    expect(result.entries[0].date).toBe('2026-07-05');
  });
});

