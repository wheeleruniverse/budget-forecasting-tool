<template>
  <div v-if="loading" class="py-20 text-center text-slate-400">
    Loading budget…
  </div>

  <div v-else-if="config" class="space-y-6">
    <section
      class="flex flex-wrap items-end justify-between gap-4 rounded-lg bg-white p-4 shadow-sm"
    >
      <div>
        <h1 class="text-xl font-bold text-slate-900">
          {{ config.meta.name }}
        </h1>
        <p v-if="config.meta.description" class="text-sm text-slate-500">
          {{ config.meta.description }}
        </p>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <label class="block text-xs font-medium text-slate-500">
          Focus date
          <input
            type="date"
            class="mt-1 block rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
            :value="focusDate"
            @change="onFocusChange"
          />
        </label>
        <button
          class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          @click="setFocusDate(todayDate)"
        >
          Today
        </button>
      </div>
    </section>

    <nav
      v-if="currencies.length > 1"
      class="flex flex-wrap items-center gap-2"
      aria-label="Currency views"
    >
      <button
        v-for="currency in currencies"
        :key="currency"
        class="rounded-full px-4 py-1.5 text-sm font-semibold"
        :class="
          activeCurrency === currency
            ? 'bg-wheeler-purple-600 text-white'
            : 'bg-white text-slate-600 shadow-sm hover:bg-wheeler-purple-50'
        "
        @click="setActiveCurrency(currency)"
      >
        {{ currency }}
      </button>
      <button
        v-if="showAllTab"
        class="rounded-full px-4 py-1.5 text-sm font-semibold"
        :class="
          activeCurrency === 'all'
            ? 'bg-wheeler-purple-600 text-white'
            : 'bg-white text-slate-600 shadow-sm hover:bg-wheeler-purple-50'
        "
        @click="setActiveCurrency('all')"
      >
        All (≈ {{ baseCurrency }})
      </button>
      <p v-if="activeCurrency === 'all'" class="text-xs text-slate-400">
        Converted with your fxRates — an estimate, not a balance.
      </p>
    </nav>

    <section
      v-if="negativeWarnings.length"
      class="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900"
    >
      <p class="text-sm font-semibold">⚠️ Projected negative balances</p>
      <ul class="mt-1 space-y-0.5 text-xs">
        <li v-for="warning in negativeWarnings" :key="warning.account.id">
          <strong>{{ warning.account.name }}</strong> is projected to drop to
          {{ formatForAccount(warning.account.id)(warning.balance) }} on
          {{ formatDisplayDate(warning.date) }}.
        </li>
      </ul>
      <p class="mt-1 text-xs text-amber-700">
        Credit accounts are ignored. Covers the days currently loaded in the
        ledger.
      </p>
    </section>

    <section v-if="focusSnapshot">
      <h2
        class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500"
      >
        Expected balances on {{ formatDisplayDate(focusDate) }}
      </h2>
      <div
        class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8"
      >
        <div
          v-for="account in visibleAccounts"
          :key="account.id"
          class="rounded-lg border-l-4 bg-white p-3 shadow-sm"
          :style="{ borderLeftColor: accountColor(account.id) }"
        >
          <p class="truncate text-xs font-medium text-slate-500">
            {{ account.name }}
          </p>
          <p
            class="text-lg font-bold"
            :class="
              focusSnapshot.balances[account.id] < 0
                ? 'text-red-600'
                : 'text-slate-900'
            "
          >
            {{
              formatForAccount(account.id)(focusSnapshot.balances[account.id])
            }}
          </p>
        </div>
        <div
          class="rounded-lg border-l-4 border-wheeler-purple-600 bg-wheeler-purple-50 p-3 shadow-sm"
        >
          <p class="text-xs font-medium text-wheeler-purple-700">
            {{ totalLabel }}
          </p>
          <p class="text-lg font-bold text-wheeler-purple-900">
            {{ formatMoney(totalFor(focusSnapshot)) }}
          </p>
        </div>
      </div>
    </section>

    <BalanceChart
      :days="ledgerDays"
      :accounts="visibleAccounts"
      :focus-date="focusDate"
      :format-money="formatMoney"
      :value-of="chartValueOf"
      :total-of="totalFor"
    />

    <LedgerTable />
  </div>
</template>

<script setup lang="ts">
import BalanceChart from '@/components/BalanceChart.vue';
import LedgerTable from '@/components/LedgerTable.vue';
import { useBudgetData } from '@/composables/useBudgetData';
import type { DaySnapshot } from '@/types';
import { accountColor as pickColor } from '@/utils/colors';
import { formatDisplayDate, today } from '@/utils/dates';
import { computed } from 'vue';

const {
  config,
  loading,
  focusDate,
  focusSnapshot,
  ledgerDays,
  baseCurrency,
  currencies,
  activeCurrency,
  setActiveCurrency,
  showAllTab,
  visibleAccounts,
  toBase,
  totalFor,
  formatMoney: formatMoneyRef,
  formatForAccount,
  setFocusDate,
} = useBudgetData();

const todayDate = today();
const formatMoney = (n: number): string => formatMoneyRef.value(n);

const totalLabel = computed(() =>
  activeCurrency.value === 'all'
    ? `All accounts (≈ ${baseCurrency.value})`
    : `All ${activeCurrency.value} accounts`
);

// First projected below-zero day per visible account, today onward. Credit
// accounts are excluded — a carried balance always reads negative there.
const negativeWarnings = computed(() => {
  const warnings: Array<{
    account: (typeof visibleAccounts.value)[number];
    date: string;
    balance: number;
  }> = [];
  for (const account of visibleAccounts.value) {
    if (account.type === 'credit') continue;
    const day = ledgerDays.value.find(
      d => d.date >= todayDate && (d.balances[account.id] ?? 0) < 0
    );
    if (day) {
      warnings.push({
        account,
        date: day.date,
        balance: day.balances[account.id],
      });
    }
  }
  return warnings;
});

// On a currency tab the chart plots exact balances; on the "All" tab every
// series is converted to base so the lines share one honest axis.
function chartValueOf(day: DaySnapshot, accountId: string): number {
  const balance = day.balances[accountId] ?? 0;
  return activeCurrency.value === 'all' ? toBase(accountId, balance) : balance;
}

function accountColor(accountId: string): string {
  const index = config.value?.accounts.findIndex(a => a.id === accountId) ?? 0;
  return config.value?.accounts[index]?.color ?? pickColor(index);
}

function onFocusChange(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  if (value) setFocusDate(value);
}
</script>
