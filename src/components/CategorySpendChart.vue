<template>
  <div :style="{ height: `${height}px` }">
    <Bar :data="data" :options="options" />
  </div>
</template>

<script setup lang="ts">
import type { CategoryTotal } from '@/utils/categories';
import { AXIS_INK, GRID_COLOR } from '@/utils/chart';
import { MAGNITUDE_HUE } from '@/utils/colors';
import type { ChartData, ChartOptions } from 'chart.js';
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';

const props = defineProps<{
  totals: CategoryTotal[];
  formatMoney: (amount: number) => string;
}>();

/** Row pitch and axis band, so the container never clips the x labels. */
const ROW_HEIGHT = 30;
const AXIS_BAND = 44;

const height = computed(() => props.totals.length * ROW_HEIGHT + AXIS_BAND);

// Categories are nominal — there is no natural order — so every bar takes the
// same hue. Ramping colour by size would double-encode the bar length.
const data = computed<ChartData<'bar'>>(() => ({
  labels: props.totals.map(total => total.label),
  datasets: [
    {
      label: 'Spent',
      data: props.totals.map(total => total.spent),
      backgroundColor: MAGNITUDE_HUE,
      borderRadius: 4,
      borderSkipped: 'start',
      barThickness: 16,
    },
  ],
}));

const options = computed<ChartOptions<'bar'>>(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { right: 12 } },
  plugins: {
    // One series: the card heading names it, so a legend box adds nothing.
    legend: { display: false },
    tooltip: {
      displayColors: false,
      callbacks: {
        label: item => {
          const total = props.totals[item.dataIndex];
          const share = (total.share * 100).toFixed(1);
          const lines = `${total.count} ${total.count === 1 ? 'line' : 'lines'}`;
          return `${props.formatMoney(total.spent)} · ${share}% · ${lines}`;
        },
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      border: { display: false },
      grid: { color: GRID_COLOR },
      ticks: {
        color: AXIS_INK,
        font: { size: 11 },
        maxTicksLimit: 6,
        callback: value => props.formatMoney(Number(value)),
      },
    },
    y: {
      border: { display: false },
      grid: { display: false },
      ticks: { color: AXIS_INK, font: { size: 12 } },
    },
  },
}));
</script>
