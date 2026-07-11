<template>
  <section class="rounded-lg bg-white p-4 shadow-sm">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
        One-time entries
      </h2>
      <button
        class="rounded-md bg-wheeler-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-wheeler-purple-700"
        @click="startNew"
      >
        + Add entry
      </button>
    </div>

    <table class="w-full text-sm">
      <thead>
        <tr
          class="border-b border-slate-200 text-left text-xs uppercase text-slate-400"
        >
          <th class="py-2 pr-4">Date</th>
          <th class="py-2 pr-4">Name</th>
          <th class="py-2 pr-4">Amount</th>
          <th class="py-2 pr-4">Account</th>
          <th class="py-2"></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="entry in sortedEntries" :key="entry.id">
          <tr class="border-b border-slate-100">
            <td class="py-2 pr-4 tabular-nums text-slate-500">
              {{ entry.date }}
            </td>
            <td class="py-2 pr-4 font-medium text-slate-800">
              {{ entry.name }}
              <span
                v-if="entry.category"
                class="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500"
              >
                {{ entry.category }}
              </span>
            </td>
            <td
              class="py-2 pr-4 tabular-nums"
              :class="
                displayAmount(entry) >= 0 ? 'text-emerald-600' : 'text-red-600'
              "
            >
              {{ formatMoney(displayAmount(entry)) }}
            </td>
            <td class="py-2 pr-4 text-slate-500">
              {{ describeTarget(entry) }}
            </td>
            <td class="py-2 text-right">
              <button
                class="mr-3 text-xs font-semibold text-wheeler-purple-600 hover:underline"
                @click="startEdit(entry)"
              >
                Edit
              </button>
              <button
                class="text-xs font-semibold text-red-500 hover:underline"
                @click="removeEntry(entry.id)"
              >
                Delete
              </button>
            </td>
          </tr>
          <tr v-if="editing && form.id === entry.id">
            <td colspan="5" class="pb-3 pt-1">
              <MovementForm
                v-model="form"
                :accounts="config?.accounts ?? []"
                with-date
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
      with-date
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
  type MovementFormModel,
} from '@/components/manage/MovementForm.vue';
import { useBudgetData } from '@/composables/useBudgetData';
import type { Entry, MoneyMovement } from '@/types';
import { makeId } from '@/utils/id';
import { isTransfer } from '@/utils/ledger';
import { computed, ref } from 'vue';

const {
  config,
  formatMoney: formatMoneyRef,
  accountsById,
  upsertEntry,
  removeEntry,
} = useBudgetData();

const formatMoney = (n: number): string => formatMoneyRef.value(n);

const editing = ref(false);
const form = ref<MovementFormModel>(emptyMovementForm());

const sortedEntries = computed(() =>
  [...(config.value?.entries ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  )
);

function displayAmount(movement: MoneyMovement): number {
  return isTransfer(movement) ? Math.abs(movement.amount) : movement.amount;
}

function describeTarget(movement: MoneyMovement): string {
  const name = (id?: string): string =>
    (id && accountsById.value.get(id)?.name) || id || '?';
  return isTransfer(movement)
    ? `${name(movement.from)} → ${name(movement.to)}`
    : name(movement.accountId);
}

function startNew(): void {
  form.value = emptyMovementForm();
  editing.value = true;
}

function startEdit(entry: Entry): void {
  form.value = movementToForm(entry, undefined, entry.date);
  editing.value = true;
}

function save(): void {
  upsertEntry({
    ...formToMovement(form.value, makeId),
    date: form.value.date,
  });
  editing.value = false;
}
</script>
