<template>
  <section v-if="days.length > 1" class="rounded-lg bg-white p-4 shadow-sm">
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Balance trend
      </h2>
      <div class="flex flex-wrap gap-3 text-xs text-slate-500">
        <span
          v-for="series in accountSeries"
          :key="series.id"
          class="flex items-center gap-1"
        >
          <span
            class="inline-block h-2 w-2 rounded-full"
            :style="{ backgroundColor: series.color }"
          />
          {{ series.name }}
        </span>
        <span class="flex items-center gap-1 font-semibold text-slate-700">
          <span class="inline-block h-2 w-3 rounded bg-slate-700" />
          Total
        </span>
      </div>
    </div>

    <svg
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      preserveAspectRatio="none"
      class="h-48 w-full"
      role="img"
      aria-label="Account balances over the visible date range"
    >
      <line
        v-if="zeroY !== null"
        :x1="0"
        :x2="WIDTH"
        :y1="zeroY"
        :y2="zeroY"
        stroke="#e2e8f0"
        stroke-width="1"
      />
      <line
        v-if="focusX !== null"
        :x1="focusX"
        :x2="focusX"
        :y1="0"
        :y2="HEIGHT"
        stroke="#a784ff"
        stroke-width="1.5"
        stroke-dasharray="4 3"
      />
      <polyline
        v-for="series in accountSeries"
        :key="series.id"
        :points="series.points"
        fill="none"
        :stroke="series.color"
        stroke-width="1.25"
        opacity="0.8"
      />
      <polyline
        :points="totalPoints"
        fill="none"
        stroke="#334155"
        stroke-width="2.25"
      />
    </svg>

    <div class="mt-1 flex justify-between text-xs text-slate-400">
      <span>{{ formatDisplayDate(days[0].date) }}</span>
      <span>
        Range: {{ formatMoney(domain.min) }} – {{ formatMoney(domain.max) }}
      </span>
      <span>{{ formatDisplayDate(days[days.length - 1].date) }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Account, DaySnapshot } from '@/types';
import { accountColor } from '@/utils/colors';
import { formatDisplayDate } from '@/utils/dates';
import { computed } from 'vue';

const WIDTH = 800;
const HEIGHT = 200;
const PAD = 8;

const props = defineProps<{
  days: DaySnapshot[];
  accounts: Account[];
  focusDate: string;
  formatMoney: (n: number) => string;
  /** Balance to plot for an account — lets the view convert currencies. */
  valueOf: (day: DaySnapshot, accountId: string) => number;
  /** Total to plot for a day — exact per-currency sum or converted estimate. */
  totalOf: (day: DaySnapshot) => number;
}>();

const domain = computed(() => {
  let min = 0;
  let max = 0;
  for (const day of props.days) {
    for (const account of props.accounts) {
      const balance = props.valueOf(day, account.id);
      if (balance < min) min = balance;
      if (balance > max) max = balance;
    }
    const total = props.totalOf(day);
    if (total < min) min = total;
    if (total > max) max = total;
  }
  if (min === max) max = min + 1;
  return { min, max };
});

function x(index: number): number {
  return (index / (props.days.length - 1)) * WIDTH;
}

function y(value: number): number {
  const { min, max } = domain.value;
  const t = (value - min) / (max - min);
  return HEIGHT - PAD - t * (HEIGHT - PAD * 2);
}

function toPoints(values: number[]): string {
  return values
    .map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ');
}

const accountSeries = computed(() =>
  props.accounts.map((account, index) => ({
    id: account.id,
    name: account.name,
    color: account.color ?? accountColor(index),
    points: toPoints(props.days.map(day => props.valueOf(day, account.id))),
  }))
);

const totalPoints = computed(() =>
  toPoints(props.days.map(day => props.totalOf(day)))
);

const zeroY = computed(() => {
  const { min, max } = domain.value;
  return min <= 0 && max >= 0 ? y(0) : null;
});

const focusX = computed(() => {
  const index = props.days.findIndex(day => day.date === props.focusDate);
  return index >= 0 ? x(index) : null;
});
</script>
