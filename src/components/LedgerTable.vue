<template>
  <section class="rounded-lg bg-white shadow-sm">
    <div
      class="flex items-center justify-between border-b border-slate-200 px-4 py-3"
    >
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Daily ledger
      </h2>
      <p class="text-xs text-slate-400">
        Click a day to see its credits and debits
      </p>
    </div>

    <div
      v-if="tabAccounts.length > 1"
      class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2"
    >
      <span class="text-xs font-medium text-slate-400">Accounts:</span>
      <button
        v-for="account in tabAccounts"
        :key="account.id"
        class="rounded-full border px-2.5 py-0.5 text-xs font-medium"
        :class="
          hiddenAccountIds.has(account.id)
            ? 'border-slate-200 text-slate-300 line-through'
            : 'border-wheeler-purple-200 bg-wheeler-purple-50 text-wheeler-purple-700'
        "
        :aria-pressed="!hiddenAccountIds.has(account.id)"
        @click="toggleAccountVisibility(account.id)"
      >
        {{ account.name }}
      </button>
      <span v-if="hiddenAccountIds.size" class="text-xs text-slate-400">
        hidden accounts are excluded from totals
      </span>
    </div>

    <div
      v-if="canExtendBack"
      class="border-b border-slate-100 px-4 py-2 text-center"
    >
      <button
        class="text-xs font-semibold text-wheeler-purple-600 hover:text-wheeler-purple-800"
        @click="extendBack"
      >
        ↑ Load earlier days
      </button>
    </div>
    <div v-else class="border-b border-slate-100 px-4 py-2 text-center">
      <p class="text-xs text-slate-400">
        Start of recorded history — no balance anchor before
        {{ earliestAnchorDate }}
      </p>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full min-w-max text-sm">
        <thead>
          <tr
            class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"
          >
            <th class="px-4 py-2 font-semibold">Date</th>
            <th
              v-for="account in accounts"
              :key="account.id"
              class="px-4 py-2 text-right font-semibold"
            >
              {{ account.name }}
              <span
                v-if="activeCurrency === 'all'"
                class="ml-1 font-normal normal-case text-slate-400"
              >
                {{ currencyOfAccount(account.id) }}
              </span>
            </th>
            <th class="px-4 py-2 text-right font-semibold">
              {{ totalHeader }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="day in visibleDays" :key="day.date">
            <tr
              class="cursor-pointer border-b border-slate-100"
              :class="rowClass(day.date)"
              @click="toggleDay(day.date)"
            >
              <td class="whitespace-nowrap px-4 py-2">
                <span class="font-medium">{{
                  formatDisplayDate(day.date)
                }}</span>
                <span
                  v-if="day.date === focusDate"
                  class="ml-2 rounded-full bg-wheeler-purple-600 px-2 py-0.5 text-[10px] font-bold text-white"
                >
                  FOCUS
                </span>
                <span
                  v-if="dayLines(day).length"
                  class="ml-2 text-xs text-slate-400"
                >
                  {{ dayLines(day).length }}
                  {{ dayLines(day).length === 1 ? 'item' : 'items' }}
                </span>
              </td>
              <td
                v-for="account in accounts"
                :key="account.id"
                class="whitespace-nowrap px-4 py-2 text-right tabular-nums"
              >
                <span :class="{ 'text-red-600': day.balances[account.id] < 0 }">
                  {{ formatForAccount(account.id)(day.balances[account.id]) }}
                </span>
                <span
                  class="ml-1 inline-block w-3 text-center text-xs"
                  :class="
                    netChange(day, account.id) > 0
                      ? 'text-emerald-600'
                      : 'text-red-500'
                  "
                >
                  {{
                    netChange(day, account.id) > 0
                      ? '▲'
                      : netChange(day, account.id) < 0
                        ? '▼'
                        : ''
                  }}
                </span>
              </td>
              <td
                class="whitespace-nowrap px-4 py-2 text-right font-semibold tabular-nums"
                :class="totalFor(day) < 0 ? 'text-red-600' : 'text-slate-900'"
              >
                {{ formatMoney(totalFor(day)) }}
              </td>
            </tr>

            <tr v-if="expandedDate === day.date" :class="rowClass(day.date)">
              <td :colspan="accounts.length + 2" class="px-4 pb-3">
                <div class="rounded-md border border-slate-200 bg-white/80 p-3">
                  <p
                    v-if="dayLines(day).length === 0"
                    class="text-xs text-slate-400"
                  >
                    No activity on this day.
                  </p>
                  <ul v-else class="divide-y divide-slate-100">
                    <li
                      v-for="line in dayLines(day)"
                      :key="line.id"
                      class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
                    >
                      <span
                        class="font-semibold tabular-nums"
                        :class="
                          line.amount >= 0 ? 'text-emerald-600' : 'text-red-600'
                        "
                      >
                        {{ line.amount >= 0 ? '+' : ''
                        }}{{ formatForAccount(line.accountId)(line.amount) }}
                      </span>
                      <span class="font-medium text-slate-800">{{
                        line.name
                      }}</span>
                      <span class="text-xs text-slate-500">
                        {{ accountName(line.accountId) }}
                        <template v-if="line.transfer">
                          {{ line.amount < 0 ? '→' : '←' }}
                          {{ accountName(line.counterAccountId!) }}
                        </template>
                      </span>
                      <span
                        v-if="line.category"
                        class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                      >
                        {{ line.category }}
                      </span>
                      <span
                        class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        :class="
                          line.source === 'rule'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-emerald-100 text-emerald-700'
                        "
                      >
                        {{ line.source === 'rule' ? 'recurring' : 'one-time' }}
                      </span>
                      <span
                        v-if="line.overridden"
                        class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                      >
                        adjusted
                      </span>

                      <span
                        v-if="line.source === 'rule'"
                        class="ml-auto flex items-center gap-2"
                        @click.stop
                      >
                        <template v-if="adjustingLineId === line.id">
                          <input
                            v-model.number="adjustAmount"
                            type="number"
                            step="0.01"
                            class="w-28 rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                          <button
                            class="text-xs font-semibold text-wheeler-purple-600"
                            @click="saveAdjustment(line)"
                          >
                            Save
                          </button>
                          <button
                            class="text-xs text-slate-400"
                            @click="adjustingLineId = null"
                          >
                            Cancel
                          </button>
                        </template>
                        <template v-else>
                          <button
                            class="text-xs font-semibold text-wheeler-purple-600 hover:underline"
                            @click="startAdjust(line)"
                          >
                            Adjust
                          </button>
                          <button
                            class="text-xs font-semibold text-red-500 hover:underline"
                            @click="skipOccurrence(line)"
                          >
                            Skip
                          </button>
                          <button
                            v-if="line.overridden"
                            class="text-xs font-semibold text-slate-500 hover:underline"
                            @click="resetOccurrence(line)"
                          >
                            Reset
                          </button>
                        </template>
                      </span>
                      <span
                        v-else
                        class="ml-auto flex items-center gap-2"
                        @click.stop
                      >
                        <button
                          class="text-xs font-semibold text-red-500 hover:underline"
                          @click="deleteEntry(line)"
                        >
                          Delete
                        </button>
                      </span>
                    </li>
                  </ul>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div class="px-4 py-2 text-center">
      <button
        class="text-xs font-semibold text-wheeler-purple-600 hover:text-wheeler-purple-800"
        @click="extendForward"
      >
        ↓ Load later days
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useBudgetData } from '@/composables/useBudgetData';
import type { DaySnapshot, LedgerLine, RuleOverride } from '@/types';
import { formatDisplayDate } from '@/utils/dates';
import { computed, ref, watch } from 'vue';

const {
  config,
  ledgerDays,
  focusDate,
  accountsById,
  baseCurrency,
  activeCurrency,
  tabAccounts,
  visibleAccounts,
  hiddenAccountIds,
  toggleAccountVisibility,
  currencyOfAccount,
  totalFor,
  formatMoney: formatMoneyRef,
  formatForAccount,
  earliestAnchorDate,
  canExtendBack,
  extendBack,
  extendForward,
  setOverride,
  removeOverride,
  removeEntry,
} = useBudgetData();

// The focus day starts expanded and follows the focus as it moves; manual
// toggling still works within a given focus.
const expandedDate = ref<string | null>(focusDate.value);
watch(focusDate, date => {
  expandedDate.value = date;
});

const adjustingLineId = ref<string | null>(null);
const adjustAmount = ref(0);

const accounts = visibleAccounts;
const formatMoney = (n: number): string => formatMoneyRef.value(n);

const visibleIds = computed(
  () => new Set(visibleAccounts.value.map(a => a.id))
);

/** The day's lines for accounts in the active currency view. */
function dayLines(day: DaySnapshot): LedgerLine[] {
  return day.lines.filter(line => visibleIds.value.has(line.accountId));
}

const totalHeader = computed(() =>
  activeCurrency.value === 'all'
    ? `≈ Total (${baseCurrency.value})`
    : `Total (${activeCurrency.value})`
);

// Quiet days are hidden to keep the ledger scannable, but the focus date
// always stays visible so its balances can be inspected.
const visibleDays = computed(() =>
  ledgerDays.value.filter(
    day => dayLines(day).length > 0 || day.date === focusDate.value
  )
);

function rowClass(date: string): string {
  if (date === focusDate.value) return 'bg-wheeler-purple-100/70';
  if (date < focusDate.value) return 'bg-slate-100 text-slate-500';
  return 'bg-sky-50/40';
}

function toggleDay(date: string): void {
  expandedDate.value = expandedDate.value === date ? null : date;
  adjustingLineId.value = null;
}

function accountName(accountId: string): string {
  return accountsById.value.get(accountId)?.name ?? accountId;
}

function netChange(day: DaySnapshot, accountId: string): number {
  return day.lines
    .filter(line => line.accountId === accountId)
    .reduce((sum, line) => sum + line.amount, 0);
}

/** Transfers produce two lines; this tells which leg a line is. */
function isTransferLeg(line: LedgerLine, leg: 'from' | 'to'): boolean {
  return !!line.transfer && line.id.endsWith(`:${leg}`);
}

function isCrossCurrency(line: LedgerLine): boolean {
  return (
    !!line.transfer &&
    !!line.counterAccountId &&
    currencyOfAccount(line.accountId) !==
      currencyOfAccount(line.counterAccountId)
  );
}

/** Existing override for this occurrence, so adjustments merge rather than replace. */
function currentOverride(line: LedgerLine): RuleOverride | undefined {
  return config.value?.overrides.find(
    o => o.ruleId === line.ruleId && o.date === line.originalDate
  );
}

function startAdjust(line: LedgerLine): void {
  adjustingLineId.value = line.id;
  adjustAmount.value = line.transfer ? Math.abs(line.amount) : line.amount;
}

function saveAdjustment(line: LedgerLine): void {
  if (!line.ruleId || !line.originalDate) return;
  const base = {
    ...currentOverride(line),
    ruleId: line.ruleId,
    date: line.originalDate,
  };
  if (line.transfer && isTransferLeg(line, 'to') && isCrossCurrency(line)) {
    // Receiving leg of a cross-currency transfer: adjust what landed.
    setOverride({ ...base, toAmount: Math.abs(adjustAmount.value) });
  } else if (line.transfer) {
    setOverride({ ...base, amount: Math.abs(adjustAmount.value) });
  } else {
    setOverride({ ...base, amount: adjustAmount.value });
  }
  adjustingLineId.value = null;
}

function skipOccurrence(line: LedgerLine): void {
  if (!line.ruleId || !line.originalDate) return;
  setOverride({ ruleId: line.ruleId, date: line.originalDate, skip: true });
}

function resetOccurrence(line: LedgerLine): void {
  if (!line.ruleId || !line.originalDate) return;
  removeOverride(line.ruleId, line.originalDate);
}

/**
 * One-time entries have no rule to override, so Delete removes the entry
 * itself (unlike Skip, which only masks a rule occurrence). Transfer legs
 * carry a ":from"/":to" suffix on the entry's id.
 */
function deleteEntry(line: LedgerLine): void {
  removeEntry(line.transfer ? line.id.replace(/:(from|to)$/, '') : line.id);
}
</script>
