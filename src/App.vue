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
    </footer>
    <SmallScreenNotice />
  </div>
</template>

<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue';
import SmallScreenNotice from '@/components/SmallScreenNotice.vue';
</script>
