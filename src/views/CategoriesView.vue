<template>
  <div v-if="loading" class="py-20 text-center text-slate-400">
    Loading budget…
  </div>

  <div v-else-if="config" class="space-y-6">
    <!-- One filter row above everything it scopes: both charts and the table
         re-render against the same slice. -->
    <section
      class="flex flex-wrap items-end justify-between gap-4 rounded-lg bg-white p-4 shadow-sm"
    >
      <div>
        <h1 class="text-xl font-bold text-slate-900">Categories</h1>
        <p class="text-sm text-slate-500">
          Recorded spending only — imported and one-time entries up to today.
          Forecast rule occurrences and transfers between your own accounts are
          excluded.
        </p>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <label class="block text-xs font-medium text-slate-500">
          Account
          <select
            v-model="accountId"
            class="mt-1 block w-56 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
          >
            <option
              v-for="account in config.accounts"
              :key="account.id"
              :value="account.id"
            >
              {{ account.name }}
            </option>
          </select>
        </label>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="preset in RANGE_PRESETS"
            :key="preset.months"
            class="rounded-md border px-3 py-1.5 text-sm font-medium"
            :class="
              rangeMonths === preset.months
                ? 'border-wheeler-purple-300 bg-wheeler-purple-50 text-wheeler-purple-700'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100'
            "
            @click="rangeMonths = preset.months"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>
    </section>

    <div class="flex flex-wrap items-center justify-between gap-2 px-1">
      <p class="text-xs text-slate-400">
        {{ formatDisplayDate(from) }} — {{ formatDisplayDate(through) }} ·
        {{ accountName }}
      </p>
      <label class="flex items-center gap-2 text-xs text-slate-500">
        <input
          v-model="groupUntaggedByName"
          type="checkbox"
          class="rounded border-slate-300"
        />
        Group untagged spending by name
      </label>
    </div>

    <section
      v-if="summary.lineCount === 0"
      class="rounded-lg bg-white p-8 text-center shadow-sm"
    >
      <p class="text-sm font-medium text-slate-600">
        No recorded entries for {{ accountName }} in this range.
      </p>
      <p class="mt-1 text-xs text-slate-400">
        Import a statement from the Data dialog, or widen the range.
      </p>
    </section>

    <template v-else>
      <!-- Headline numbers are stat tiles, not one-bar charts. -->
      <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-lg bg-white p-4 shadow-sm">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total spent
          </p>
          <p class="mt-1 text-2xl font-bold text-slate-900">
            {{ money(summary.totalSpent) }}
          </p>
        </div>
        <div class="rounded-lg bg-white p-4 shadow-sm">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total received
          </p>
          <p class="mt-1 text-2xl font-bold text-emerald-700">
            {{ money(summary.totalReceived) }}
          </p>
        </div>
        <div class="rounded-lg bg-white p-4 shadow-sm">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
            Bins
          </p>
          <p class="mt-1 text-2xl font-bold text-slate-900">
            {{ spendingCategoryCount }}
          </p>
          <p class="mt-0.5 text-xs text-slate-400">
            across {{ summary.lineCount }}
            {{ summary.lineCount === 1 ? 'line' : 'lines' }}
          </p>
        </div>
        <div class="rounded-lg bg-white p-4 shadow-sm">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
            Untagged
          </p>
          <p
            class="mt-1 text-2xl font-bold"
            :class="
              uncategorizedShare > 0.25 ? 'text-amber-600' : 'text-slate-900'
            "
          >
            {{ money(summary.uncategorizedSpent) }}
          </p>
          <p class="mt-0.5 text-xs text-slate-400">
            {{ (uncategorizedShare * 100).toFixed(0) }}% of spending
          </p>
        </div>
      </section>

      <section
        v-if="flash"
        class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
      >
        {{ flash }} Export your JSON to keep the change.
      </section>

      <section
        v-else-if="uncategorizedShare > 0.25"
        class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
      >
        Most of this account's spending has no category.
        <template v-if="groupUntaggedByName">
          Untagged rows are grouped by name below — use
          <strong>Assign</strong> to tag a whole merchant at once.
        </template>
        <template v-else>
          Turn on <strong>Group untagged spending by name</strong> to tag them
          in bulk.
        </template>
      </section>

      <section
        v-if="spendingTotals.length"
        class="rounded-lg bg-white p-4 shadow-sm"
      >
        <h2
          class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500"
        >
          Spending by category
        </h2>
        <CategorySpendChart
          :totals="spendingTotals"
          :format-money="compactMoney"
        />
      </section>

      <section
        v-if="summary.months.length > 1 && spendingTotals.length"
        class="rounded-lg bg-white p-4 shadow-sm"
      >
        <h2
          class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500"
        >
          Monthly trend
        </h2>
        <CategoryTrendChart
          :months="summary.months"
          :series="stackedSeries"
          :format-money="compactMoney"
        />
      </section>

      <!-- The table view: every plotted value is readable without hovering. -->
      <section class="rounded-lg bg-white p-4 shadow-sm">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2
            class="text-sm font-semibold uppercase tracking-wide text-slate-500"
          >
            All bins
          </h2>
          <p v-if="sortBy === 'label'" class="text-xs text-slate-400">
            Sorted by name — store numbers put the same merchant together.
          </p>
        </div>

        <!-- Bulk bar: tag several bins at once, for merchants the name split
             across store numbers. -->
        <div
          v-if="selectedBinKeys.length"
          class="mb-3 flex flex-wrap items-end gap-3 rounded-md border border-wheeler-purple-200 bg-wheeler-purple-50 p-3"
        >
          <p class="text-sm font-medium text-wheeler-purple-900">
            {{ selectedBinKeys.length }}
            {{ selectedBinKeys.length === 1 ? 'bin' : 'bins' }} ·
            {{ selectedEntryIds.length }}
            {{ selectedEntryIds.length === 1 ? 'entry' : 'entries' }}
          </p>
          <label class="block text-xs font-medium text-slate-500">
            Category
            <input
              v-model="bulkValue"
              list="known-categories"
              placeholder="e.g. groceries"
              class="mt-1 block w-56 rounded border border-slate-300 px-2 py-1.5 text-sm"
              @keyup.enter="applyBulkAssign()"
            />
          </label>
          <button
            class="rounded-md bg-wheeler-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-wheeler-purple-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            :disabled="!canBulkAssign"
            @click="applyBulkAssign()"
          >
            Assign to {{ selectedEntryIds.length }}
            {{ selectedEntryIds.length === 1 ? 'entry' : 'entries' }}
          </button>
          <button
            class="text-xs font-medium text-slate-500 underline hover:text-slate-700"
            @click="selectedBinKeys = []"
          >
            Clear selection
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-xs uppercase tracking-wide text-slate-400">
              <tr class="border-b border-slate-200">
                <th class="w-8 py-2 pr-2">
                  <input
                    type="checkbox"
                    class="rounded border-slate-300"
                    aria-label="Select every bin"
                    :checked="allBinsSelected"
                    @change="toggleAllBins"
                  />
                </th>
                <th class="py-2 pr-4 font-medium">
                  <button
                    class="uppercase tracking-wide hover:text-slate-600"
                    @click="setSort('label')"
                  >
                    Bin {{ sortIndicator('label') }}
                  </button>
                </th>
                <th class="py-2 pr-4 text-right font-medium">
                  <button
                    class="uppercase tracking-wide hover:text-slate-600"
                    @click="setSort('spent')"
                  >
                    Spent {{ sortIndicator('spent') }}
                  </button>
                </th>
                <th class="py-2 pr-4 text-right font-medium">Share</th>
                <th class="py-2 pr-4 text-right font-medium">Received</th>
                <th class="py-2 pr-4 text-right font-medium">Lines</th>
                <th class="py-2 text-right font-medium">Category</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="total in sortedTotals" :key="total.key">
                <tr
                  class="border-b border-slate-100"
                  :class="{
                    'bg-wheeler-purple-50/50': selectedBinKeys.includes(
                      total.key
                    ),
                  }"
                >
                  <td class="py-2 pr-2">
                    <input
                      v-model="selectedBinKeys"
                      type="checkbox"
                      :value="total.key"
                      class="rounded border-slate-300"
                      :aria-label="`Select ${total.label}`"
                    />
                  </td>
                  <td class="py-2 pr-4 font-medium text-slate-800">
                    {{ total.label }}
                    <span
                      v-if="total.derived"
                      class="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                      title="Grouped by entry name — not a category you set"
                    >
                      by name
                    </span>
                    <span
                      v-else-if="total.key === UNCATEGORIZED_KEY"
                      class="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                    >
                      untagged
                    </span>
                  </td>
                  <td class="py-2 pr-4 text-right tabular-nums text-slate-800">
                    {{ total.spent > 0 ? money(total.spent) : '—' }}
                  </td>
                  <td class="py-2 pr-4 text-right tabular-nums text-slate-500">
                    {{
                      total.spent > 0
                        ? `${(total.share * 100).toFixed(1)}%`
                        : '—'
                    }}
                  </td>
                  <td
                    class="py-2 pr-4 text-right tabular-nums text-emerald-700"
                  >
                    {{ total.received > 0 ? money(total.received) : '—' }}
                  </td>
                  <td class="py-2 pr-4 text-right tabular-nums text-slate-500">
                    {{ total.count }}
                  </td>
                  <td class="py-2 text-right">
                    <button
                      class="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      :aria-expanded="assigningKey === total.key"
                      @click="toggleAssign(total)"
                    >
                      {{ assigningKey === total.key ? 'Cancel' : 'Assign' }}
                    </button>
                  </td>
                </tr>
                <tr v-if="assigningKey === total.key" class="bg-slate-50">
                  <td colspan="7" class="p-4">
                    <div class="flex flex-wrap items-end gap-3">
                      <label class="block text-xs font-medium text-slate-500">
                        Category for the selected entries
                        <input
                          v-model="assignValue"
                          list="known-categories"
                          placeholder="e.g. software"
                          class="mt-1 block w-64 rounded border border-slate-300 px-2 py-1.5 text-sm"
                          @keyup.enter="applyAssign()"
                        />
                      </label>
                      <button
                        class="rounded-md bg-wheeler-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-wheeler-purple-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        :disabled="!canAssign"
                        @click="applyAssign()"
                      >
                        Assign to {{ selectedIds.length }}
                        {{ selectedIds.length === 1 ? 'entry' : 'entries' }}
                      </button>
                      <button
                        class="text-xs font-medium text-slate-500 underline hover:text-slate-700"
                        @click="applyAssign(true)"
                      >
                        Clear category instead
                      </button>
                    </div>
                    <p class="mt-1 text-xs text-slate-400">
                      Applies to this account only. Untick anything that doesn't
                      belong.
                    </p>

                    <div
                      class="mt-3 max-h-56 overflow-y-auto rounded border border-slate-200 bg-white"
                    >
                      <label
                        v-for="entry in assignEntries"
                        :key="entry.id"
                        class="flex items-center gap-3 border-b border-slate-100 px-3 py-1.5 text-xs last:border-b-0 hover:bg-slate-50"
                      >
                        <input
                          v-model="selectedIds"
                          type="checkbox"
                          :value="entry.id"
                          class="rounded border-slate-300"
                        />
                        <span class="w-24 shrink-0 tabular-nums text-slate-500">
                          {{ entry.date }}
                        </span>
                        <span class="flex-1 truncate text-slate-700">
                          {{ entry.name }}
                        </span>
                        <span class="tabular-nums text-slate-600">
                          {{ money(entry.amount) }}
                        </span>
                      </label>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
            <tfoot>
              <tr class="font-semibold text-slate-900">
                <td class="py-2 pr-2"></td>
                <td class="py-2 pr-4">Total</td>
                <td class="py-2 pr-4 text-right tabular-nums">
                  {{ money(summary.totalSpent) }}
                </td>
                <td class="py-2 pr-4"></td>
                <td class="py-2 pr-4 text-right tabular-nums">
                  {{ money(summary.totalReceived) }}
                </td>
                <td class="py-2 pr-4 text-right tabular-nums">
                  {{ summary.lineCount }}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <datalist id="known-categories">
          <option v-for="name in knownCategories" :key="name" :value="name" />
        </datalist>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import CategorySpendChart from '@/components/CategorySpendChart.vue';
import CategoryTrendChart from '@/components/CategoryTrendChart.vue';
import { useBudgetData } from '@/composables/useBudgetData';
import type { Entry } from '@/types';
import type { CategoryTotal } from '@/utils/categories';
import {
  summarizeCategories,
  topCategories,
  UNCATEGORIZED_KEY,
} from '@/utils/categories';
import { addMonths, formatDisplayDate, today } from '@/utils/dates';
import { computed, ref, watch } from 'vue';

const { config, loading, formatForAccount, currencyOfAccount, assignCategory } =
  useBudgetData();

/** The categorical palette has six slots; the sixth holds the folded tail. */
const STACK_LIMIT = 5;

const RANGE_PRESETS = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '12M', months: 12 },
] as const;

const accountId = ref(config.value?.accounts[0]?.id ?? '');
const rangeMonths = ref(3);
const groupUntaggedByName = ref(true);

const assigningKey = ref<string | null>(null);
const assignValue = ref('');
const selectedIds = ref<string[]>([]);
const flash = ref('');

type SortField = 'spent' | 'label';
const sortBy = ref<SortField>('spent');
const sortDir = ref<'asc' | 'desc'>('desc');

const selectedBinKeys = ref<string[]>([]);
const bulkValue = ref('');

// The sample template loads asynchronously, so adopt its first account once
// it arrives — and recover if the chosen account disappears on re-import.
watch(
  () => config.value?.accounts,
  accounts => {
    if (!accounts?.length) return;
    if (!accounts.some(account => account.id === accountId.value)) {
      accountId.value = accounts[0].id;
    }
  },
  { immediate: true }
);

// An open panel or selection refers to bins that may not survive a filter
// change, so both are dropped when the slice moves.
watch([accountId, rangeMonths, groupUntaggedByName], () => {
  closeAssign();
  selectedBinKeys.value = [];
});

const through = computed(() => today());
const from = computed(() => addMonths(through.value, -rangeMonths.value));

const summary = computed(() =>
  config.value && accountId.value
    ? summarizeCategories(
        config.value,
        accountId.value,
        from.value,
        through.value,
        { groupUntaggedByName: groupUntaggedByName.value }
      )
    : {
        totals: [],
        months: [],
        totalSpent: 0,
        totalReceived: 0,
        uncategorizedSpent: 0,
        lineCount: 0,
      }
);

const spendingTotals = computed(() =>
  summary.value.totals.filter(total => total.spent > 0)
);

/**
 * Table order only — the ranked chart always stays sorted by magnitude.
 * Name sorting is case-insensitive and numeric-aware so "Albert Heijn 1503"
 * and "Albert Heijn 1853" land next to each other rather than being split by
 * their store numbers.
 */
const sortedTotals = computed(() => {
  const direction = sortDir.value === 'asc' ? 1 : -1;
  return [...summary.value.totals].sort((a, b) => {
    if (sortBy.value === 'label') {
      return (
        direction *
        a.label.localeCompare(b.label, undefined, {
          sensitivity: 'base',
          numeric: true,
        })
      );
    }
    return direction * (a.spent - b.spent) || a.label.localeCompare(b.label);
  });
});

function setSort(field: SortField): void {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    return;
  }
  sortBy.value = field;
  // Names read best A→Z; money reads best biggest-first.
  sortDir.value = field === 'label' ? 'asc' : 'desc';
}

function sortIndicator(field: SortField): string {
  if (sortBy.value !== field) return '';
  return sortDir.value === 'asc' ? '▲' : '▼';
}
const spendingCategoryCount = computed(() => spendingTotals.value.length);
const stackedSeries = computed(() =>
  topCategories(summary.value.totals, STACK_LIMIT)
);

const uncategorizedShare = computed(() =>
  summary.value.totalSpent === 0
    ? 0
    : summary.value.uncategorizedSpent / summary.value.totalSpent
);

const accountName = computed(
  () =>
    config.value?.accounts.find(a => a.id === accountId.value)?.name ??
    'this account'
);

/** Every category already in use, so retagging reuses names instead of forking them. */
const knownCategories = computed(() => {
  const seen = new Set<string>();
  for (const movement of [
    ...(config.value?.entries ?? []),
    ...(config.value?.rules ?? []),
  ]) {
    const category = movement.category?.trim();
    if (category) seen.add(category);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
});

const entriesById = computed(() => {
  const map = new Map<string, Entry>();
  for (const entry of config.value?.entries ?? []) map.set(entry.id, entry);
  return map;
});

/** The entries behind the open bin, oldest first. */
const assignEntries = computed(() => {
  const bin = summary.value.totals.find(t => t.key === assigningKey.value);
  if (!bin) return [];
  return bin.entryIds
    .map(id => entriesById.value.get(id))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date));
});

/** Entry ids behind every ticked bin, de-duplicated. */
const selectedEntryIds = computed(() => {
  const keys = new Set(selectedBinKeys.value);
  const ids = new Set<string>();
  for (const total of summary.value.totals) {
    if (!keys.has(total.key)) continue;
    for (const id of total.entryIds) ids.add(id);
  }
  return [...ids];
});

const allBinsSelected = computed(
  () =>
    summary.value.totals.length > 0 &&
    selectedBinKeys.value.length === summary.value.totals.length
);

const canBulkAssign = computed(
  () => selectedEntryIds.value.length > 0 && bulkValue.value.trim() !== ''
);

function toggleAllBins(): void {
  selectedBinKeys.value = allBinsSelected.value
    ? []
    : summary.value.totals.map(total => total.key);
}

function applyBulkAssign(): void {
  if (!canBulkAssign.value) return;
  const category = bulkValue.value.trim();
  const bins = selectedBinKeys.value.length;
  const updated = assignCategory(selectedEntryIds.value, category);
  if (updated > 0) {
    flash.value =
      `Tagged ${updated} ${updated === 1 ? 'entry' : 'entries'} ` +
      `from ${bins} ${bins === 1 ? 'bin' : 'bins'} as "${category}".`;
  }
  selectedBinKeys.value = [];
  bulkValue.value = '';
  closeAssign();
}

function closeAssign(): void {
  assigningKey.value = null;
  selectedIds.value = [];
  assignValue.value = '';
}

function toggleAssign(total: CategoryTotal): void {
  if (assigningKey.value === total.key) {
    closeAssign();
    return;
  }
  flash.value = '';
  assigningKey.value = total.key;
  selectedIds.value = [...total.entryIds];
  // A name-derived bin has no real category yet, so start from blank.
  assignValue.value = total.derived ? '' : total.label;
}

/** Blank input clears rather than tags, so that path needs the explicit button. */
const canAssign = computed(
  () => selectedIds.value.length > 0 && assignValue.value.trim() !== ''
);

function applyAssign(clear = false): void {
  if (!clear && !canAssign.value) return;
  const updated = assignCategory(
    selectedIds.value,
    clear ? '' : assignValue.value
  );
  if (updated > 0) {
    flash.value = clear
      ? `Cleared the category on ${updated} ${updated === 1 ? 'entry' : 'entries'}.`
      : `Tagged ${updated} ${updated === 1 ? 'entry' : 'entries'} as "${assignValue.value.trim()}".`;
  }
  closeAssign();
}

const money = computed(() => formatForAccount(accountId.value));

/** Axis and tooltip ticks drop the decimals so labels stay short. */
const compactMoney = computed(() => {
  const currency = currencyOfAccount(accountId.value);
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  return (amount: number): string => formatter.format(amount);
});
</script>
