<template>
  <form
    class="grid grid-cols-2 gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 sm:grid-cols-6"
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
      Type
      <select
        v-model="model.type"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option v-for="t in ACCOUNT_TYPES" :key="t" :value="t">{{ t }}</option>
      </select>
    </label>
    <label class="block text-xs font-medium text-slate-500">
      Currency
      <select
        v-model="model.currency"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">Base currency ({{ baseCurrency }})</option>
        <option
          v-for="option in CURRENCY_OPTIONS"
          :key="option.code"
          :value="option.code"
        >
          {{ option.label }}
        </option>
      </select>
    </label>
    <label class="block text-xs font-medium text-slate-500">
      Known balance
      <input
        v-model.number="model.balance"
        type="number"
        step="0.01"
        required
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block text-xs font-medium text-slate-500">
      As of (end of day)
      <input
        v-model="model.date"
        type="date"
        required
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <div class="flex items-end gap-2">
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
import type { Account, AccountType } from '@/types';
import { today } from '@/utils/dates';

export interface AccountFormModel {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  date: string;
  currency: string;
  color?: string;
}

export function emptyAccountForm(): AccountFormModel {
  return {
    id: '',
    name: '',
    type: 'checking',
    balance: 0,
    date: today(),
    currency: '',
    color: undefined,
  };
}

export function accountToForm(account: Account): AccountFormModel {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    balance: account.anchor.balance,
    date: account.anchor.date,
    currency: account.currency ?? '',
    color: account.color,
  };
}

export default {};
</script>

<script setup lang="ts">
import { currencyOptions } from '@/utils/currencies';

const ACCOUNT_TYPES: AccountType[] = [
  'checking',
  'savings',
  'credit',
  'cash',
  'investment',
  'other',
];

const CURRENCY_OPTIONS = currencyOptions();

defineProps<{ baseCurrency: string }>();

const model = defineModel<AccountFormModel>({ required: true });

const emit = defineEmits<{
  save: [];
  cancel: [];
}>();
</script>
