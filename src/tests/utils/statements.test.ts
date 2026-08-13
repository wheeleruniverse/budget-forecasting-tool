import type { Account, Entry, ImportRule } from '@/types';
import {
  parseCsv,
  parseStatementAmount,
  statementToEntries,
  statementToEntriesWithRules,
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

// Mirrors a minimal mock of the column layout used by Wise CSV exports.
const MOCK_WISE_CSV = `"TransferWise ID","Date","Amount","Currency","Description","Payee Account Number","Exchange To Amount","Transaction Details Type"
"MOCK-001","05-07-2026","-24.99","EUR","Mock Grocery Store","","","CARD_TRANSACTION"
"MOCK-002","10-07-2026","-500.00","EUR","Converted 500.00 EUR to 567.00 USD (fee: 2.00 EUR)","","567.00","CONVERSION"
"MOCK-003","15-07-2026","-200.00","EUR","Sent money to Mock Person","NL00MOCK0000000000","","TRANSFER"
"MOCK-004","20-07-2026","-50.00","EUR","Invoice paid to Mock Vendor","NL99EXTR9999999999","","TRANSFER"
`;

function mockWiseAccount(extraRules: ImportRule[] = []): Account {
  return {
    id: 'mock-eur',
    name: 'Mock EUR',
    type: 'checking',
    anchor: { date: '2026-07-01', balance: 1000 },
    import: {
      dateFormat: 'dd-MM-yyyy',
      rules: [
        {
          when: { 'Transaction Details Type': 'CONVERSION' },
          shape: {
            id: '${TransferWise ID}',
            date: '${Date}',
            name: '${Description}',
            amount: '${Amount}',
            toAmount: '${Exchange To Amount}',
            to: 'mock-usd',
          },
        },
        {
          when: {
            'Transaction Details Type': 'TRANSFER',
            'Payee Account Number': 'NL00MOCK0000000000',
          },
          shape: {
            id: '${TransferWise ID}',
            date: '${Date}',
            name: '${Description}',
            amount: '${Amount}',
            to: 'mock-savings',
          },
        },
        ...extraRules,
        {
          shape: {
            id: '${TransferWise ID}',
            date: '${Date}',
            name: '${Description}',
            amount: '${Amount}',
          },
        },
      ],
    },
  };
}

describe('statementToEntriesWithRules', () => {
  it('imports plain rows via the default catch-all rule', () => {
    const result = statementToEntriesWithRules(
      MOCK_WISE_CSV,
      mockWiseAccount(),
      []
    );
    const grocery = result.entries.find(e => e.id === 'MOCK-001');
    expect(grocery).toMatchObject({
      date: '2026-07-05',
      amount: -24.99,
      accountId: 'mock-eur',
    });
  });

  it('shapes CONVERSION rows as transfers with toAmount', () => {
    const result = statementToEntriesWithRules(
      MOCK_WISE_CSV,
      mockWiseAccount(),
      []
    );
    const conversion = result.entries.find(e => e.id === 'MOCK-002');
    expect(conversion).toMatchObject({
      date: '2026-07-10',
      amount: -500,
      from: 'mock-eur',
      to: 'mock-usd',
      toAmount: 567,
    });
    expect(conversion?.accountId).toBeUndefined();
  });

  it('routes transfers to a known own-account IBAN as internal transfers', () => {
    const result = statementToEntriesWithRules(
      MOCK_WISE_CSV,
      mockWiseAccount(),
      []
    );
    const transfer = result.entries.find(e => e.id === 'MOCK-003');
    expect(transfer).toMatchObject({ from: 'mock-eur', to: 'mock-savings' });
  });

  it('routes transfers to an unknown external IBAN as plain debits via catch-all', () => {
    const result = statementToEntriesWithRules(
      MOCK_WISE_CSV,
      mockWiseAccount(),
      []
    );
    const external = result.entries.find(e => e.id === 'MOCK-004');
    expect(external).toMatchObject({ accountId: 'mock-eur', amount: -50 });
    expect(external?.from).toBeUndefined();
  });

  it('normalizes IBAN spacing and case in conditions', () => {
    const accountWithSpacedIban = mockWiseAccount([
      {
        when: {
          'Transaction Details Type': 'transfer',
          'Payee Account Number': 'nl00 mock 0000 0000 00',
        },
        shape: {
          id: '${TransferWise ID}',
          date: '${Date}',
          name: '${Description}',
          amount: '${Amount}',
          from: 'mock-eur',
          to: 'mock-savings',
        },
      },
    ]);
    const result = statementToEntriesWithRules(
      MOCK_WISE_CSV,
      accountWithSpacedIban,
      []
    );
    const transfer = result.entries.find(e => e.id === 'MOCK-003');
    expect(transfer).toMatchObject({ from: 'mock-eur', to: 'mock-savings' });
  });

  it('uses the shape id field as-is without slugifying', () => {
    const result = statementToEntriesWithRules(
      MOCK_WISE_CSV,
      mockWiseAccount(),
      []
    );
    expect(result.entries.map(e => e.id)).toEqual([
      'MOCK-001',
      'MOCK-002',
      'MOCK-003',
      'MOCK-004',
    ]);
  });

  it('silently drops rows whose matching rule has shape.skip set', () => {
    const account = mockWiseAccount([
      {
        when: { 'Transaction Details Type': 'CARD_TRANSACTION' },
        shape: { skip: 'Handled by another account' },
      },
    ]);
    const result = statementToEntriesWithRules(MOCK_WISE_CSV, account, []);
    expect(result.entries.find(e => e.id === 'MOCK-001')).toBeUndefined();
    expect(result.problems).not.toContain(expect.stringContaining('MOCK-001'));
  });

  it('counts duplicate entries against existing ones', () => {
    const existing: Entry[] = [
      {
        id: 'MOCK-001',
        name: 'Mock Grocery Store',
        amount: -24.99,
        accountId: 'mock-eur',
        date: '2026-07-05',
      },
    ];
    const result = statementToEntriesWithRules(
      MOCK_WISE_CSV,
      mockWiseAccount(),
      existing
    );
    expect(result.duplicateCount).toBe(1);
    expect(result.entries).toHaveLength(4);
  });
});
