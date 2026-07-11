<template>
  <section class="rounded-lg bg-white p-4 shadow-sm">
    <h2
      class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500"
    >
      Occurrence overrides
    </h2>
    <p v-if="overrides.length === 0" class="text-sm text-slate-400">
      None yet. Use <strong>Adjust</strong> or <strong>Skip</strong> on a
      recurring item in the ledger to override a single occurrence.
    </p>
    <table v-else class="w-full text-sm">
      <thead>
        <tr
          class="border-b border-slate-200 text-left text-xs uppercase text-slate-400"
        >
          <th class="py-2 pr-4">Rule</th>
          <th class="py-2 pr-4">Occurrence</th>
          <th class="py-2 pr-4">Change</th>
          <th class="py-2"></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="override in overrides"
          :key="`${override.ruleId}|${override.date}`"
          class="border-b border-slate-100"
        >
          <td class="py-2 pr-4 font-medium text-slate-800">
            {{ ruleName(override.ruleId) }}
          </td>
          <td class="py-2 pr-4 tabular-nums text-slate-500">
            {{ override.date }}
          </td>
          <td class="py-2 pr-4 text-slate-500">{{ describe(override) }}</td>
          <td class="py-2 text-right">
            <button
              class="text-xs font-semibold text-red-500 hover:underline"
              @click="removeOverride(override.ruleId, override.date)"
            >
              Remove
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup lang="ts">
import { useBudgetData } from '@/composables/useBudgetData';
import type { RuleOverride } from '@/types';
import { computed } from 'vue';

const { config, formatMoney: formatMoneyRef, removeOverride } = useBudgetData();

const overrides = computed(() => config.value?.overrides ?? []);

function ruleName(ruleId: string): string {
  return config.value?.rules.find(r => r.id === ruleId)?.name ?? ruleId;
}

function describe(override: RuleOverride): string {
  const changes: string[] = [];
  if (override.skip) changes.push('skipped');
  if (override.amount !== undefined) {
    changes.push(`amount → ${formatMoneyRef.value(override.amount)}`);
  }
  if (override.moveTo) changes.push(`moved to ${override.moveTo}`);
  if (override.name) changes.push(`renamed to "${override.name}"`);
  return changes.join(', ') || '—';
}
</script>
