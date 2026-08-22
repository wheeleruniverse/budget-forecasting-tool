import { useBudgetData } from '@/composables/useBudgetData';
import { DEFAULT_COLUMN_MAPPING } from '@/utils/statements';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEMPLATE = {
  version: 1,
  meta: { name: 'Statement Batch Test', baseCurrency: 'USD' },
  accounts: [
    {
      id: 'mock-checking',
      name: 'Mock Checking',
      type: 'checking',
      anchor: { date: '2026-01-01', balance: 1000 },
      currency: 'USD',
    },
  ],
  rules: [],
  entries: [],
};

// The composable auto-loads the template on first use; serving the fixture
// here keeps every test starting from the same clean config.
vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({
    ok: true,
    json: async () => structuredClone(TEMPLATE),
  }))
);

function csv(name: string, body: string): File {
  return new File([body], name, { type: 'text/csv' });
}

const HEADER = 'Date,Amount,Name';

describe('importStatements', () => {
  let api: ReturnType<typeof useBudgetData>;

  beforeEach(async () => {
    api = useBudgetData();
    await api.loadSample();
  });

  async function run(files: File[]) {
    return api.importStatements(files, 'mock-checking', {
      ...DEFAULT_COLUMN_MAPPING,
    });
  }

  it('totals entries across every selected file', async () => {
    const summary = await run([
      csv('jan.csv', `${HEADER}\n2026-01-05,-12.34,Cafe\n2026-01-06,-1.00,Gum`),
      csv('feb.csv', `${HEADER}\n2026-02-05,-56.78,Pizza`),
    ]);

    expect(summary).not.toBeNull();
    expect(summary?.imported).toBe(3);
    expect(summary?.files).toBe(2);
    expect(summary?.failures).toEqual([]);
    expect(api.config.value?.entries).toHaveLength(3);
  });

  it('detects duplicates that span two files in the same batch', async () => {
    const row = '2026-01-05,-12.34,Cafe';
    const summary = await run([
      csv('first.csv', `${HEADER}\n${row}`),
      csv('overlap.csv', `${HEADER}\n${row}\n2026-01-09,-3.00,Coffee`),
    ]);

    // The repeated row is only a duplicate if the second file is parsed
    // against the entries the first one already added.
    expect(summary?.imported).toBe(3);
    expect(summary?.duplicates).toBe(1);
  });

  it('advances the forecast fence to the day after the latest row', async () => {
    await run([
      csv('early.csv', `${HEADER}\n2026-01-05,-12.34,Cafe`),
      csv('late.csv', `${HEADER}\n2026-03-20,-56.78,Pizza`),
    ]);

    expect(api.config.value?.meta.forecastFrom).toBe('2026-03-21');
  });

  it('imports the good files and reports the empty one', async () => {
    const summary = await run([
      csv('good.csv', `${HEADER}\n2026-01-05,-12.34,Cafe`),
      csv('empty.csv', HEADER),
    ]);

    expect(summary?.imported).toBe(1);
    expect(summary?.files).toBe(1);
    expect(summary?.failures).toEqual([
      '"empty.csv" contained no importable rows.',
    ]);
    expect(api.error.value).toBeNull();
  });

  it('tags row problems with their file when several are selected', async () => {
    const summary = await run([
      csv('good.csv', `${HEADER}\n2026-01-05,-12.34,Cafe`),
      csv('bad.csv', `${HEADER}\nnot-a-date,-1.00,Mystery`),
    ]);

    expect(summary?.problems.some(p => p.startsWith('bad.csv: '))).toBe(true);
  });

  it('errors only when the whole batch imports nothing', async () => {
    const summary = await run([csv('a.csv', HEADER), csv('b.csv', HEADER)]);

    expect(summary).toBeNull();
    expect(api.error.value?.message).toBe(
      'None of the 2 selected files contained importable rows.'
    );
    expect(api.config.value?.entries).toHaveLength(0);
  });
});
