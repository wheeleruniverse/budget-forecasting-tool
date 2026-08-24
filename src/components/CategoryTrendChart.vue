<template>
  <div class="h-64">
    <Bar :data="data" :options="options" />
  </div>
</template>

<script setup lang="ts">
import type { CategoryMonth, CategoryTotal } from '@/utils/categories';
import { monthlySeries } from '@/utils/categories';
import { AXIS_INK, GRID_COLOR, SURFACE } from '@/utils/chart';
import { categoryColor } from '@/utils/colors';
import type { ChartData, ChartOptions } from 'chart.js';
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';

const props = defineProps<{
  months: CategoryMonth[];
  /** Already folded to at most the palette's slot count by `topCategories`. */
  series: CategoryTotal[];
  formatMoney: (amount: number) => string;
}>();

const monthLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});

function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return monthLabel.format(new Date(Date.UTC(y, m - 1, 1)));
}

const data = computed<ChartData<'bar'>>(() => ({
  labels: props.months.map(month => formatMonth(month.month)),
  datasets: monthlySeries(props.months, props.series).map((entry, index) => ({
    label: entry.label,
    data: entry.values,
    backgroundColor: categoryColor(index),
    // A surface-coloured edge is the 2px gap between stacked segments.
    borderColor: SURFACE,
    borderWidth: 2,
    borderRadius: 2,
    maxBarThickness: 56,
  })),
}));

const options = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: AXIS_INK,
        boxWidth: 10,
        boxHeight: 10,
        usePointStyle: true,
        pointStyle: 'circle',
        font: { size: 11 },
      },
    },
    tooltip: {
      callbacks: {
        label: item =>
          `${item.dataset.label}: ${props.formatMoney(Number(item.parsed.y))}`,
        footer: items => {
          const total = items.reduce(
            (sum, item) => sum + Number(item.parsed.y),
            0
          );
          return `Total: ${props.formatMoney(total)}`;
        },
      },
    },
  },
  scales: {
    x: {
      stacked: true,
      border: { display: false },
      grid: { display: false },
      ticks: { color: AXIS_INK, font: { size: 11 } },
    },
    y: {
      stacked: true,
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
  },
}));
</script>
