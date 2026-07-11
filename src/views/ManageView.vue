<template>
  <div v-if="config" class="space-y-8">
    <section class="rounded-lg bg-white p-4 shadow-sm">
      <h1 class="text-xl font-bold text-slate-900">Manage budget data</h1>
      <p class="mt-1 text-sm text-slate-500">
        Changes here only live in this browser session. Use
        <strong>Export JSON</strong> in the header to save them back to your
        file. You can also edit your JSON directly — download the template to
        see the full shape.
      </p>
    </section>

    <AccountsManager />
    <RulesManager />
    <EntriesManager />
    <OverridesManager />
  </div>
</template>

<script setup lang="ts">
import AccountsManager from '@/components/manage/AccountsManager.vue';
import EntriesManager from '@/components/manage/EntriesManager.vue';
import OverridesManager from '@/components/manage/OverridesManager.vue';
import RulesManager from '@/components/manage/RulesManager.vue';
import { useBudgetData } from '@/composables/useBudgetData';

const { config } = useBudgetData();
</script>
