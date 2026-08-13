<template>
  <div
    v-if="!acknowledged"
    class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="disclaimer-title"
  >
    <div class="my-8 w-full max-w-lg rounded-lg bg-white shadow-xl">
      <div class="border-b border-slate-200 px-6 py-4">
        <h2 id="disclaimer-title" class="text-lg font-bold text-slate-900">
          ⚠️ Before You Use This
        </h2>
      </div>

      <div class="space-y-4 px-6 py-5 text-sm text-slate-600">
        <p>
          This is a personal side project. It's free, I build it in my spare
          time, and I can't promise to keep it working. It is
          <strong>not financial advice</strong>, and it isn't a paid or
          professional service.
        </p>
        <p>
          The app comes with <strong>no warranty of any kind</strong>. Money
          data is risky to work with, so please check every number yourself. You
          are responsible for your own data and for any choices you make based
          on this app. As far as the law allows, I accept
          <strong>no liability</strong> for any loss or damage that comes from
          using it.
        </p>
        <p>
          Your data stays in your browser. Nothing is sent to a server or saved
          anywhere. If you make changes inside the app, export your file before
          you close the tab or you'll lose them.
        </p>
        <p>
          The full terms are in the
          <a
            class="font-semibold text-wheeler-purple-700 underline hover:text-wheeler-purple-800"
            :href="`${REPO_URL}/blob/main/LICENSE`"
            target="_blank"
            rel="noopener noreferrer"
            >MIT License</a
          >
          (<a
            class="font-semibold text-wheeler-purple-700 underline hover:text-wheeler-purple-800"
            href="https://choosealicense.com/licenses/mit/"
            target="_blank"
            rel="noopener noreferrer"
            >what is that?</a
          >). The source is public on
          <a
            class="font-semibold text-wheeler-purple-700 underline hover:text-wheeler-purple-800"
            :href="REPO_URL"
            target="_blank"
            rel="noopener noreferrer"
            >GitHub</a
          >, so you can read it before you trust it.
        </p>
      </div>

      <div class="flex justify-end border-t border-slate-200 px-6 py-4">
        <button
          class="rounded-md bg-wheeler-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-wheeler-purple-700"
          @click="acknowledged = true"
        >
          I understand
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const REPO_URL = 'https://github.com/wheeleruniverse/budget-forecasting-tool';

// Not persisted, so the disclaimer shows on every app load by design.
const acknowledged = ref(false);
</script>
