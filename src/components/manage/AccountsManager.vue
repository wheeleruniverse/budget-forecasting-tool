<template>
  <section class="rounded-lg bg-white p-4 shadow-sm">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Accounts
      </h2>
      <button
        class="rounded-md bg-wheeler-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-wheeler-purple-700"
        @click="startNew"
      >
        + Add account
      </button>
    </div>

    <p v-if="deleteError" class="mb-2 text-xs text-red-600">
      {{ deleteError }}
    </p>

    <table class="w-full text-sm">
      <thead>
        <tr
          class="border-b border-slate-200 text-left text-xs uppercase text-slate-400"
        >
          <th class="py-2 pr-4">Name</th>
          <th class="py-2 pr-4">Type</th>
          <th class="py-2 pr-4">Balance anchor</th>
          <th class="py-2"></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="account in config?.accounts ?? []" :key="account.id">
          <tr class="border-b border-slate-100">
            <td class="py-2 pr-4 font-medium text-slate-800">
              <span
                class="mr-2 inline-block h-2 w-2 rounded-full"
                :style="{ backgroundColor: colorFor(account) }"
              />
              {{ account.name }}
            </td>
            <td class="py-2 pr-4 capitalize text-slate-500">
              {{ account.type }}
              <span v-if="account.currency" class="normal-case">
                · {{ account.currency }}
              </span>
            </td>
            <td class="py-2 pr-4 tabular-nums text-slate-500">
              {{ formatMoney(account.anchor.balance) }} on
              {{ account.anchor.date }}
            </td>
            <td class="py-2 text-right">
              <button
                class="mr-3 text-xs font-semibold text-wheeler-purple-600 hover:underline"
                @click="startEdit(account)"
              >
                Edit
              </button>
              <button
                class="text-xs font-semibold text-red-500 hover:underline"
                @click="onRemove(account.id)"
              >
                Delete
              </button>
            </td>
          </tr>
          <tr v-if="editing && form.id === account.id">
            <td colspan="4" class="pb-3 pt-1">
              <AccountForm
                v-model="form"
                :base-currency="baseCurrency"
                @save="save"
                @cancel="editing = false"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <AccountForm
      v-if="editing && !form.id"
      v-model="form"
      :base-currency="baseCurrency"
      class="mt-4"
      @save="save"
      @cancel="editing = false"
    />
  </section>
</template>

<script setup lang="ts">
import AccountForm, {
  accountToForm,
  emptyAccountForm,
  type AccountFormModel,
} from '@/components/manage/AccountForm.vue';
import { useBudgetData } from '@/composables/useBudgetData';
import type { Account } from '@/types';
import { accountColor } from '@/utils/colors';
import { makeId } from '@/utils/id';
import { ref } from 'vue';

const {
  config,
  baseCurrency,
  formatMoney: formatMoneyRef,
  upsertAccount,
  removeAccount,
} = useBudgetData();

const formatMoney = (n: number): string => formatMoneyRef.value(n);

const editing = ref(false);
const deleteError = ref<string | null>(null);
const form = ref<AccountFormModel>(emptyAccountForm());

function colorFor(account: Account): string {
  const index = config.value?.accounts.findIndex(a => a.id === account.id) ?? 0;
  return account.color ?? accountColor(index);
}

function startNew(): void {
  form.value = emptyAccountForm();
  editing.value = true;
}

function startEdit(account: Account): void {
  form.value = accountToForm(account);
  editing.value = true;
}

function save(): void {
  upsertAccount({
    id: form.value.id || makeId(form.value.name),
    name: form.value.name,
    type: form.value.type,
    anchor: { date: form.value.date, balance: form.value.balance },
    currency: form.value.currency.trim().toUpperCase() || undefined,
    color: form.value.color,
  });
  editing.value = false;
}

function onRemove(accountId: string): void {
  deleteError.value = removeAccount(accountId);
}
</script>
