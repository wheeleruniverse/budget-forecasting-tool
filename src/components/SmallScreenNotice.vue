<template>
  <div
    v-if="!dismissed"
    class="fixed inset-x-4 bottom-4 z-50 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-lg lg:hidden"
    role="alert"
  >
    <p class="text-sm font-semibold text-amber-900">🖥️ Built for desktop</p>
    <p class="mt-1 text-xs text-amber-800">
      This app is designed for large screens — the multi-account ledger gets
      cramped here, and uploading/downloading your JSON is awkward on mobile. It
      will still work, but expect rough edges.
    </p>
    <button
      class="mt-2 rounded-md bg-amber-400 px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-300"
      @click="dismissed = true"
    >
      Got it
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const dismissed = ref(false);
</script>
