<template>
  <form
    class="grid grid-cols-2 gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4"
    @submit.prevent="emit('save')"
  >
    <label class="block text-xs font-medium text-slate-500">
      Name
      <input
        v-model="model.name"
        required
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>

    <label class="block text-xs font-medium text-slate-500">
      Kind
      <select
        v-model="model.kind"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="income">Income (credit)</option>
        <option value="expense">Expense (debit)</option>
        <option value="transfer">Transfer</option>
      </select>
    </label>

    <label class="block text-xs font-medium text-slate-500">
      Amount
      <input
        v-model.number="model.amount"
        type="number"
        step="0.01"
        min="0"
        required
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>

    <label class="block text-xs font-medium text-slate-500">
      Category (optional)
      <input
        v-model="model.category"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>

    <template v-if="model.kind === 'transfer'">
      <label class="block text-xs font-medium text-slate-500">
        From account
        <select
          v-model="model.from"
          required
          class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option v-for="a in accounts" :key="a.id" :value="a.id">
            {{ a.name }}
          </option>
        </select>
      </label>
      <label class="block text-xs font-medium text-slate-500">
        To account
        <select
          v-model="model.to"
          required
          class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option v-for="a in accounts" :key="a.id" :value="a.id">
            {{ a.name }}
          </option>
        </select>
      </label>
      <label class="block text-xs font-medium text-slate-500">
        Received amount (optional)
        <input
          v-model.number="model.toAmount"
          type="number"
          step="0.01"
          min="0"
          placeholder="for cross-currency"
          class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
    </template>
    <label v-else class="block text-xs font-medium text-slate-500">
      Account
      <select
        v-model="model.accountId"
        required
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option v-for="a in accounts" :key="a.id" :value="a.id">
          {{ a.name }}
        </option>
      </select>
    </label>

    <label v-if="withDate" class="block text-xs font-medium text-slate-500">
      Date
      <input
        v-model="model.date"
        type="date"
        required
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>

    <template v-if="withRecurrence">
      <label class="block text-xs font-medium text-slate-500">
        Frequency
        <select
          v-model="model.frequency"
          class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option v-for="f in FREQUENCIES" :key="f" :value="f">{{ f }}</option>
        </select>
      </label>
      <label class="block text-xs font-medium text-slate-500">
        First occurrence
        <input
          v-model="model.start"
          type="date"
          required
          class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label class="block text-xs font-medium text-slate-500">
        Ends (optional)
        <input
          v-model="model.end"
          type="date"
          class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label
        v-if="['monthly', 'quarterly', 'yearly'].includes(model.frequency)"
        class="block text-xs font-medium text-slate-500"
      >
        Day of month (number or "last")
        <input
          v-model="model.dayOfMonth"
          placeholder="from first occurrence"
          class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label
        v-if="model.frequency === 'semimonthly'"
        class="block text-xs font-medium text-slate-500"
      >
        Days of month (comma separated)
        <input
          v-model="model.daysText"
          placeholder="1, 15"
          class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
    </template>

    <div class="col-span-2 flex items-end gap-2 sm:col-span-4">
      <button
        type="submit"
        class="rounded-md bg-wheeler-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-wheeler-purple-700"
      >
        Save
      </button>
      <button
        type="button"
        class="text-xs text-slate-400 hover:text-slate-600"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>
  </form>
</template>

<script lang="ts">
import type { Frequency, MoneyMovement, Recurrence } from '@/types';
import { today } from '@/utils/dates';
import { isTransfer } from '@/utils/ledger';

export interface MovementFormModel {
  id: string;
  name: string;
  kind: 'income' | 'expense' | 'transfer';
  amount: number;
  category: string;
  accountId: string;
  from: string;
  to: string;
  toAmount: number | '';
  date: string;
  frequency: Frequency;
  start: string;
  end: string;
  dayOfMonth: string;
  daysText: string;
}

export function emptyMovementForm(): MovementFormModel {
  return {
    id: '',
    name: '',
    kind: 'expense',
    amount: 0,
    category: '',
    accountId: '',
    from: '',
    to: '',
    toAmount: '',
    date: today(),
    frequency: 'monthly',
    start: today(),
    end: '',
    dayOfMonth: '',
    daysText: '',
  };
}

export function movementToForm(
  movement: MoneyMovement,
  recurrence?: Recurrence,
  date?: string
): MovementFormModel {
  return {
    ...emptyMovementForm(),
    id: movement.id,
    name: movement.name,
    kind: isTransfer(movement)
      ? 'transfer'
      : movement.amount >= 0
        ? 'income'
        : 'expense',
    amount: Math.abs(movement.amount),
    category: movement.category ?? '',
    accountId: movement.accountId ?? '',
    from: movement.from ?? '',
    to: movement.to ?? '',
    toAmount: movement.toAmount ?? '',
    date: date ?? today(),
    frequency: recurrence?.frequency ?? 'monthly',
    start: recurrence?.start ?? today(),
    end: recurrence?.end ?? '',
    dayOfMonth: recurrence?.dayOfMonth?.toString() ?? '',
    daysText: recurrence?.days?.join(', ') ?? '',
  };
}

export function formToMovement(
  form: MovementFormModel,
  makeId: (name: string) => string
): MoneyMovement {
  const amount = Math.abs(form.amount);
  const base = {
    id: form.id || makeId(form.name),
    name: form.name,
    category: form.category || undefined,
  };
  if (form.kind === 'transfer') {
    return {
      ...base,
      amount,
      from: form.from,
      to: form.to,
      toAmount: form.toAmount === '' ? undefined : Math.abs(form.toAmount),
    };
  }
  return {
    ...base,
    amount: form.kind === 'expense' ? -amount : amount,
    accountId: form.accountId,
  };
}

export function parseDayOfMonth(value: string): number | 'last' | undefined {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (trimmed === 'last') return 'last';
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : undefined;
}

export function parseDaysText(value: string): number[] | undefined {
  const days = value
    .split(',')
    .map(part => Number(part.trim()))
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 31);
  return days.length > 0 ? days : undefined;
}

const FREQUENCIES: Frequency[] = [
  'daily',
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
  'quarterly',
  'yearly',
];

export default {};
</script>

<script setup lang="ts">
import type { Account } from '@/types';

defineProps<{
  accounts: Account[];
  withRecurrence?: boolean;
  withDate?: boolean;
}>();

const model = defineModel<MovementFormModel>({ required: true });

const emit = defineEmits<{
  save: [];
  cancel: [];
}>();
</script>
