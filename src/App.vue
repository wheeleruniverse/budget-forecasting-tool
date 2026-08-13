<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="w-full flex-1 px-4 py-6 sm:px-6">
      <router-view />
    </main>
    <footer class="border-t border-slate-200 bg-white py-4">
      <p class="text-center text-xs text-slate-400">
        Your data never leaves your browser — no API calls, no storage, no
        tracking. Export before you close the tab.
      </p>
      <p class="mt-1 text-center text-xs text-slate-400">
        © 2026 Wheeler Universe ·
        <a
          class="underline hover:text-slate-600"
          href="https://github.com/wheeleruniverse/budget-forecasting-tool/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
          >MIT License</a
        >
      </p>
    </footer>
    <SmallScreenNotice />
    <DisclaimerModal />
  </div>
</template>

<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue';
import DisclaimerModal from '@/components/DisclaimerModal.vue';
import SmallScreenNotice from '@/components/SmallScreenNotice.vue';
</script>
