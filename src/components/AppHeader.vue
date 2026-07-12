<template>
  <header
    class="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm"
  >
    <div
      class="flex w-full flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6"
    >
      <router-link to="/" class="flex items-center gap-2">
        <span class="text-xl">📊</span>
        <span class="text-lg font-bold text-wheeler-purple-700">
          Budget Forecast
        </span>
      </router-link>

      <nav class="flex items-center gap-4 text-sm font-medium">
        <router-link
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="text-slate-500 hover:text-wheeler-purple-600"
          active-class="text-wheeler-purple-700"
        >
          {{ link.label }}
        </router-link>
      </nav>

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <span
          v-if="source === 'sample'"
          class="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800"
        >
          Sample data
        </span>
        <span
          v-else
          class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
        >
          {{ fileName }}<template v-if="dirty"> — unsaved changes</template>
        </span>

        <button
          class="relative rounded-md bg-wheeler-purple-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-wheeler-purple-700"
          :class="{ 'ring-2 ring-amber-400': dirty }"
          @click="showDataModal = true"
        >
          Data
          <span
            v-if="dirty"
            class="absolute -right-1.5 -top-1.5 flex h-4 w-4 animate-pulse items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-amber-950"
            title="Unsaved in-app changes — export your JSON"
            aria-label="Unsaved in-app changes"
          >
            !
          </span>
        </button>
      </div>
    </div>

    <div
      v-if="error && !showDataModal"
      class="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:px-6"
    >
      <div class="flex w-full items-start justify-between gap-4">
        <div>
          <p class="font-semibold">{{ error.message }}</p>
          <ul
            v-if="Array.isArray(error.details)"
            class="mt-1 list-inside list-disc text-xs"
          >
            <li v-for="problem in error.details" :key="problem">
              {{ problem }}
            </li>
          </ul>
        </div>
        <button class="text-xs font-semibold underline" @click="clearError">
          Dismiss
        </button>
      </div>
    </div>

    <DataModal v-if="showDataModal" @close="showDataModal = false" />
  </header>
</template>

<script setup lang="ts">
import DataModal from '@/components/DataModal.vue';
import { useBudgetData } from '@/composables/useBudgetData';
import { ref } from 'vue';

const { source, fileName, dirty, error, clearError } = useBudgetData();

const links = [
  { to: '/', label: 'Ledger' },
  { to: '/manage', label: 'Manage' },
];

const showDataModal = ref(false);
</script>
