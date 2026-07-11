<template>
  <section class="rounded-lg bg-white p-4 shadow-sm">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Recurring rules
      </h2>
      <button
        class="rounded-md bg-wheeler-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-wheeler-purple-700"
        @click="startNew"
      >
        + Add rule
      </button>
    </div>

    <table class="w-full text-sm">
      <thead>
        <tr
          class="border-b border-slate-200 text-left text-xs uppercase text-slate-400"
        >
          <th class="py-2 pr-4">Name</th>
          <th class="py-2 pr-4">Amount</th>
          <th class="py-2 pr-4">Account</th>
          <th class="py-2 pr-4">Schedule</th>
          <th class="py-2"></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="rule in config?.rules ?? []" :key="rule.id">
          <tr class="border-b border-slate-100">
            <td class="py-2 pr-4 font-medium text-slate-800">
              {{ rule.name }}
              <span
                v-if="rule.category"
                class="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500"
              >
                {{ rule.category }}
              </span>
            </td>
            <td
              class="py-2 pr-4 tabular-nums"
              :class="
                movementAmount(rule) >= 0 ? 'text-emerald-600' : 'text-red-600'
              "
            >
              {{ formatMoney(movementAmount(rule)) }}
            </td>
            <td class="py-2 pr-4 text-slate-500">{{ describeTarget(rule) }}</td>
            <td class="py-2 pr-4 text-slate-500">
              {{ describeSchedule(rule) }}
            </td>
            <td class="py-2 text-right">
              <button
                class="mr-3 text-xs font-semibold text-wheeler-purple-600 hover:underline"
                @click="startEdit(rule)"
              >
                Edit
              </button>
              <button
                class="text-xs font-semibold text-red-500 hover:underline"
                @click="removeRule(rule.id)"
              >
                Delete
              </button>
            </td>
          </tr>
          <tr v-if="editing && form.id === rule.id">
            <td colspan="5" class="pb-3 pt-1">
              <MovementForm
                v-model="form"
                :accounts="config?.accounts ?? []"
                with-recurrence
                @save="save"
                @cancel="editing = false"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <MovementForm
      v-if="editing && !form.id"
      v-model="form"
      :accounts="config?.accounts ?? []"
      with-recurrence
      class="mt-4"
      @save="save"
      @cancel="editing = false"
    />
  </section>
</template>

<script setup lang="ts">
import MovementForm, {
  emptyMovementForm,
  formToMovement,
  movementToForm,
  parseDayOfMonth,
  parseDaysText,
  type MovementFormModel,
} from '@/components/manage/MovementForm.vue';
import { useBudgetData } from '@/composables/useBudgetData';
import type { MoneyMovement, Rule } from '@/types';
import { makeId } from '@/utils/id';
import { isTransfer } from '@/utils/ledger';
import { ref } from 'vue';

const {
  config,
  formatMoney: formatMoneyRef,
  accountsById,
  upsertRule,
  removeRule,
} = useBudgetData();

const formatMoney = (n: number): string => formatMoneyRef.value(n);

const editing = ref(false);
const form = ref<MovementFormModel>(emptyMovementForm());

function movementAmount(movement: MoneyMovement): number {
  return isTransfer(movement) ? Math.abs(movement.amount) : movement.amount;
}

function describeTarget(movement: MoneyMovement): string {
  const name = (id?: string): string =>
    (id && accountsById.value.get(id)?.name) || id || '?';
  return isTransfer(movement)
    ? `${name(movement.from)} → ${name(movement.to)}`
    : name(movement.accountId);
}

function describeSchedule(rule: Rule): string {
  const r = rule.recurrence;
  let schedule: string = r.frequency;
  if (r.frequency === 'semimonthly') {
    schedule += ` (days ${(r.days ?? [1, 15]).join(' & ')})`;
  } else if (r.dayOfMonth) {
    schedule += ` (day ${r.dayOfMonth})`;
  }
  schedule += ` from ${r.start}`;
  if (r.end) schedule += ` to ${r.end}`;
  return schedule;
}

function startNew(): void {
  form.value = emptyMovementForm();
  editing.value = true;
}

function startEdit(rule: Rule): void {
  form.value = movementToForm(rule, rule.recurrence);
  editing.value = true;
}

function save(): void {
  const movement = formToMovement(form.value, makeId);
  upsertRule({
    ...movement,
    recurrence: {
      frequency: form.value.frequency,
      start: form.value.start,
      end: form.value.end || undefined,
      dayOfMonth: parseDayOfMonth(form.value.dayOfMonth),
      days:
        form.value.frequency === 'semimonthly'
          ? parseDaysText(form.value.daysText)
          : undefined,
    },
  });
  editing.value = false;
}
</script>
