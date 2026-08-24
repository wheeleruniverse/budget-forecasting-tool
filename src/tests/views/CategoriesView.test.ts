import { useBudgetData } from '@/composables/useBudgetData';
import CategoriesView from '@/views/CategoriesView.vue';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Dates are relative to today, so the fixture is generated around it.
function monthsAgo(n: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - n, 15));
  return d.toISOString().slice(0, 10);
}

const TEMPLATE = {
  version: 1,
  meta: { name: 'Category View Test', baseCurrency: 'USD' },
  accounts: [
    {
      id: 'card',
      name: 'Mock Card',
      type: 'credit',
      anchor: { date: monthsAgo(12), balance: 0 },
      currency: 'USD',
    },
    {
      id: 'checking',
      name: 'Mock Checking',
      type: 'checking',
      anchor: { date: monthsAgo(12), balance: 5000 },
      currency: 'USD',
    },
  ],
  rules: [],
  entries: [
    {
      id: 'e1',
      name: 'Groceries',
      date: monthsAgo(1),
      amount: -120,
      category: 'food',
      accountId: 'card',
    },
    {
      id: 'e2',
      name: 'Rent',
      date: monthsAgo(1),
      amount: -900,
      category: 'housing',
      accountId: 'card',
    },
    {
      id: 'e3',
      name: 'Mystery charge',
      date: monthsAgo(2),
      amount: -40,
      accountId: 'card',
    },
    // One merchant the bank split across store numbers, plus a case variant —
    // modeled on real statement data.
    {
      id: 'ah1',
      name: 'Albert Heijn 1503',
      date: monthsAgo(1),
      amount: -30,
      accountId: 'card',
    },
    {
      id: 'ah2',
      name: 'Albert Heijn 2207',
      date: monthsAgo(2),
      amount: -20,
      accountId: 'card',
    },
    {
      id: 'kr1',
      name: 'KRUIDVAT 6214',
      date: monthsAgo(1),
      amount: -10,
      accountId: 'card',
    },
    {
      id: 'e4',
      name: 'Other account spend',
      date: monthsAgo(1),
      amount: -777,
      category: 'food',
      accountId: 'checking',
    },
  ],
  overrides: [],
};

vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({
    ok: true,
    json: async () => structuredClone(TEMPLATE),
  }))
);

// The charts need a real canvas; stubbing them keeps this test on the view's
// own logic. Their inputs are covered by the categories util tests.
const global = {
  stubs: {
    CategorySpendChart: {
      props: ['totals'],
      template: '<div data-test="spend-chart">{{ totals.length }}</div>',
    },
    CategoryTrendChart: {
      props: ['series'],
      template: '<div data-test="trend-chart">{{ series.length }}</div>',
    },
  },
};

describe('CategoriesView', () => {
  let wrapper: ReturnType<typeof mount>;

  beforeEach(async () => {
    // The composable is a module-level singleton, so an assignment made by
    // one test would otherwise leak into the next.
    await useBudgetData().loadSample();
    wrapper = mount(CategoriesView, { global });
    await flushPromises();
  });

  it('renders the ranked table for the first account only', async () => {
    const text = wrapper.text();

    expect(text).toContain('Mock Card');
    expect(text).toContain('housing');
    expect(text).toContain('food');
    // The 777 belongs to the other account and must not leak in.
    expect(text).not.toContain('777');
  });

  it('bins untagged spending under its entry name, marked as derived', () => {
    const text = wrapper.text();

    expect(text).toContain('Mystery charge');
    expect(text).toContain('by name');
    // The headline still reports the gap even though the bin is name-derived.
    expect(text).toContain('Untagged');
  });

  it('lumps untagged spending back together when grouping is off', async () => {
    await wrapper.get('input[type="checkbox"]').setValue(false);
    await flushPromises();

    expect(wrapper.text()).toContain('Uncategorized');
    expect(wrapper.text()).toContain('untagged');
  });

  const derivedPills = () =>
    wrapper.findAll('[title^="Grouped by entry name"]').length;

  it('assigns a category to one bin from its own row', async () => {
    expect(derivedPills()).toBe(4);

    // Rows default to spent-descending: housing, food, then Mystery charge.
    const assignButtons = wrapper
      .findAll('button')
      .filter(b => b.text() === 'Assign');
    await assignButtons[2].trigger('click');
    await flushPromises();

    await wrapper.get('input[list="known-categories"]').setValue('mystery');
    const submit = wrapper
      .findAll('button')
      .find(b => b.text().startsWith('Assign to'));
    expect(submit?.text()).toContain('1 entry');

    await submit!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Tagged 1 entry as "mystery"');
    // That bin re-forms under the real category; the other three stay derived.
    expect(derivedPills()).toBe(3);
  });

  /** Bin-select checkboxes carry an aria-label; the grouping toggle does not. */
  function binCheckbox(label: string) {
    return wrapper.get(`input[aria-label="Select ${label}"]`);
  }

  it('sorts bins by name so store numbers of one merchant sit together', async () => {
    const sortButton = wrapper
      .findAll('button')
      .find(b => b.text().startsWith('Bin'));
    await sortButton!.trigger('click');
    await flushPromises();

    const names = wrapper
      .findAll('tbody tr td:nth-child(2)')
      .map(td => td.text().replace(' by name', '').trim());

    expect(names.indexOf('Albert Heijn 2207')).toBe(
      names.indexOf('Albert Heijn 1503') + 1
    );
    // Case-insensitive, so a lowercase category still sorts among the names.
    expect(names).toEqual(
      [...names].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
      )
    );
  });

  it('tags several bins at once from the bulk bar', async () => {
    await binCheckbox('Albert Heijn 1503').setValue(true);
    await binCheckbox('Albert Heijn 2207').setValue(true);
    await binCheckbox('KRUIDVAT 6214').setValue(true);
    await flushPromises();

    expect(wrapper.text()).toContain('3 bins · 3 entries');

    await wrapper.get('input[list="known-categories"]').setValue('groceries');
    const submit = wrapper
      .findAll('button')
      .find(b => b.text().startsWith('Assign to'));
    await submit!.trigger('click');
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('Tagged 3 entries from 3 bins as "groceries"');
    // The three merchants collapse into one real category bin worth 30+20+10.
    expect(text).toContain('groceries');
    expect(wrapper.text()).not.toContain('Albert Heijn');
  });

  it('selects and clears every bin from the header checkbox', async () => {
    await wrapper.get('input[aria-label="Select every bin"]').setValue(true);
    await flushPromises();
    expect(wrapper.text()).toContain('6 bins');

    await wrapper.get('input[aria-label="Select every bin"]').setValue(false);
    await flushPromises();
    expect(wrapper.text()).not.toContain('Clear selection');
  });

  it('drops a stale bin selection when the account changes', async () => {
    await binCheckbox('Albert Heijn 1503').setValue(true);
    await flushPromises();
    expect(wrapper.text()).toContain('1 bin');

    await wrapper.get('select').setValue('checking');
    await flushPromises();

    expect(wrapper.text()).not.toContain('Clear selection');
  });

  it('refuses to assign a blank category', async () => {
    const assignButtons = wrapper
      .findAll('button')
      .filter(b => b.text() === 'Assign');
    await assignButtons[0].trigger('click');
    await flushPromises();

    await wrapper.get('input[list="known-categories"]').setValue('   ');
    const submit = wrapper
      .findAll('button')
      .find(b => b.text().startsWith('Assign to'));

    expect(submit?.attributes('disabled')).toBeDefined();
  });

  it('passes only spending categories to the ranked chart', () => {
    const chart = wrapper.get('[data-test="spend-chart"]');
    // food, housing, and the four name-derived merchant bins.
    expect(chart.text()).toBe('6');
  });

  it('switches the whole page when the account changes', async () => {
    await wrapper.get('select').setValue('checking');
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('Mock Checking');
    expect(text).not.toContain('housing');
  });

  it('shows an empty state when the range excludes everything', async () => {
    // The 1M preset is the first button; nothing in the fixture is that recent.
    const buttons = wrapper.findAll('button');
    await buttons[0].trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('No recorded entries');
    expect(wrapper.find('[data-test="spend-chart"]').exists()).toBe(false);
  });
});
