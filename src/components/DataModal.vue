<template>
  <div
    class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4"
    @click.self="emit('close')"
  >
    <div class="my-8 w-full max-w-3xl rounded-lg bg-white shadow-xl">
      <div
        class="flex items-center justify-between border-b border-slate-200 px-6 py-4"
      >
        <h2 class="text-lg font-bold text-slate-900">Your data</h2>
        <button
          class="text-2xl leading-none text-slate-400 hover:text-slate-600"
          aria-label="Close"
          @click="emit('close')"
        >
          &times;
        </button>
      </div>

      <div class="space-y-6 px-6 py-5">
        <section>
          <p class="text-sm text-slate-600">
            This app never sends your finances anywhere: there are no API calls,
            no accounts, and nothing is stored. Your JSON is parsed in the
            browser and held in memory only — refresh the page and it's gone.
            Only the <em>shape</em> of the data lives in this project; the
            values are always yours.
          </p>
          <ol
            class="mt-3 list-inside list-decimal space-y-1 text-sm text-slate-600"
          >
            <li>
              <strong>Download the template</strong> — sample data showing every
              field.
            </li>
            <li>
              <strong>Replace the values</strong> with your own (keep the file
              outside any git repo, or name it
              <code class="rounded bg-slate-100 px-1">*.budget.json</code>).
            </li>
            <li><strong>Upload it</strong> at the start of each session.</li>
            <li>
              <strong>Export</strong> — only needed if you edit
              <em>inside the app</em> (the Manage page, Adjust/Skip/Delete on a
              ledger row, or an uploaded statement). Those edits exist only in
              memory until you export and overwrite your file. If you edit your
              JSON directly and re-upload, you never need this.
            </li>
          </ol>
          <p class="mt-2 text-sm text-slate-600">
            Keep one file per context — for example
            <code class="rounded bg-slate-100 px-1">personal.budget.json</code>
            and
            <code class="rounded bg-slate-100 px-1">business.budget.json</code>
            — and upload whichever you want to work with.
          </p>
        </section>

        <section class="flex flex-wrap items-center gap-2">
          <button
            class="rounded-md bg-wheeler-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-wheeler-purple-700"
            @click="fileInput?.click()"
          >
            Upload JSON
          </button>
          <button
            class="rounded-md border border-wheeler-purple-300 px-4 py-2 text-sm font-semibold text-wheeler-purple-700 hover:bg-wheeler-purple-50"
            :class="{ 'ring-2 ring-amber-400': dirty }"
            @click="exportConfig"
          >
            Export JSON
          </button>
          <button
            class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            @click="downloadTemplate"
          >
            Download template
          </button>
          <button
            class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            :class="{
              'border-wheeler-purple-300 bg-wheeler-purple-50 text-wheeler-purple-700':
                statementOpen,
            }"
            @click="toggleStatementPanel"
          >
            Upload statement
          </button>
          <p v-if="dirty" class="w-full text-xs text-amber-600">
            You have unsaved in-app changes — export before closing the tab.
          </p>
          <input
            ref="fileInput"
            type="file"
            accept=".json,application/json"
            class="hidden"
            @change="onFileSelected"
          />
        </section>

        <section
          v-if="statementOpen"
          class="rounded-md border border-slate-200 bg-slate-50 p-4"
        >
          <p class="text-sm text-slate-600">
            Import a bank statement CSV export as
            <strong>one-time entries</strong> on a single account. Tell it what
            the name, amount, and date columns are called in
            <em>your file's</em> header row (capitalization doesn't matter;
            leave Name blank if there is no name-like column). Every other
            column is ignored. Every row is added — uploading overlapping
            statements creates duplicates, which you can delete from the ledger
            or the Manage page.
          </p>
          <div class="mt-3 space-y-3">
            <label class="block text-xs font-medium text-slate-500">
              Account
              <select
                v-model="statementAccountId"
                class="mt-1 block w-64 rounded border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="" disabled>Choose an account…</option>
                <option
                  v-for="account in config?.accounts ?? []"
                  :key="account.id"
                  :value="account.id"
                >
                  {{ account.name }}
                </option>
              </select>
            </label>
            <label class="block text-xs font-medium text-slate-500">
              Name column
              <input
                v-model="statementMapping.name"
                placeholder="(none)"
                class="mt-1 block w-64 rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label class="block text-xs font-medium text-slate-500">
              Amount column
              <input
                v-model="statementMapping.amount"
                class="mt-1 block w-64 rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <div class="flex items-end gap-3">
              <label class="block text-xs font-medium text-slate-500">
                Date column
                <input
                  v-model="statementMapping.date"
                  class="mt-1 block w-40 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label class="block text-xs font-medium text-slate-500">
                Date format
                <input
                  v-model="statementMapping.dateFormat"
                  class="mt-1 block w-36 rounded border border-slate-300 px-2 py-1.5 text-sm font-mono"
                />
              </label>
            </div>
            <button
              class="rounded-md bg-wheeler-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-wheeler-purple-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              :disabled="!statementReady"
              @click="statementInput?.click()"
            >
              Choose CSV
            </button>
            <input
              ref="statementInput"
              type="file"
              accept=".csv,text/csv"
              class="hidden"
              @change="onStatementSelected"
            />
          </div>
          <div v-if="statementSummary" class="mt-3 space-y-1 text-sm">
            <p class="font-semibold text-emerald-700">
              Imported {{ statementSummary.imported }}
              {{ statementSummary.imported === 1 ? 'entry' : 'entries' }}
              into {{ accountName(statementAccountId) }}.
            </p>
            <p
              v-if="statementSummary.duplicates > 0"
              class="text-xs text-amber-600"
            >
              {{ statementSummary.duplicates }} of them match existing entries
              (same account, date, amount, and name) — likely an overlapping
              statement. Delete the extras from the ledger day view or the
              Manage page.
            </p>
            <ul
              v-if="statementSummary.problems.length"
              class="list-inside list-disc text-xs text-slate-500"
            >
              <li v-for="problem in statementSummary.problems" :key="problem">
                Skipped — {{ problem }}
              </li>
            </ul>
          </div>
        </section>

        <section
          v-if="error"
          class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <p class="font-semibold">{{ error.message }}</p>
          <ul
            v-if="Array.isArray(error.details)"
            class="mt-1 list-inside list-disc text-xs"
          >
            <li v-for="problem in error.details" :key="problem">
              {{ problem }}
            </li>
          </ul>
        </section>

        <section>
          <h3
            class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500"
          >
            <button
              class="flex items-center gap-1.5 uppercase tracking-wide hover:text-slate-700"
              :aria-expanded="fieldReferenceOpen"
              @click="fieldReferenceOpen = !fieldReferenceOpen"
            >
              Field reference
              <span class="text-xs">{{ fieldReferenceOpen ? '▾' : '▸' }}</span>
            </button>
          </h3>
          <dl v-if="fieldReferenceOpen" class="space-y-3 text-sm">
            <div v-for="field in FIELD_REFERENCE" :key="field.name">
              <dt class="flex items-center gap-1 font-semibold text-slate-800">
                <code class="rounded bg-slate-100 px-1">{{ field.name }}</code>
                <button
                  v-if="field.example"
                  class="flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold leading-none"
                  :class="
                    expandedExample === field.name
                      ? 'border-wheeler-purple-600 bg-wheeler-purple-600 text-white'
                      : 'border-slate-300 text-slate-400 hover:border-wheeler-purple-400 hover:text-wheeler-purple-600'
                  "
                  :aria-expanded="expandedExample === field.name"
                  :aria-label="`Toggle example for ${field.name}`"
                  @click="toggleExample(field.name)"
                >
                  i
                </button>
              </dt>
              <dd class="mt-0.5 text-slate-600">
                <template
                  v-for="(segment, i) in segments(field.description)"
                  :key="i"
                >
                  <code
                    v-if="segment.code"
                    class="rounded bg-slate-100 px-1 text-[13px]"
                    >{{ segment.text }}</code
                  ><template v-else>{{ segment.text }}</template>
                </template>
                <span v-if="field.values" class="mt-1 flex flex-wrap gap-1">
                  <code
                    v-for="value in field.values"
                    :key="value"
                    class="rounded bg-wheeler-purple-50 px-1.5 py-0.5 text-xs text-wheeler-purple-800"
                  >
                    {{ value }}
                  </code>
                </span>
                <pre
                  v-if="field.example && expandedExample === field.name"
                  class="mt-2 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100"
                  >{{ field.example }}</pre>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  useBudgetData,
  type StatementImportSummary,
} from '@/composables/useBudgetData';
import { DEFAULT_COLUMN_MAPPING } from '@/utils/statements';
import { computed, ref, watch } from 'vue';

const {
  config,
  dirty,
  error,
  importFile,
  importStatement,
  exportConfig,
  downloadTemplate,
  clearError,
} = useBudgetData();

const emit = defineEmits<{ close: [] }>();

const fileInput = ref<HTMLInputElement | null>(null);
const expandedExample = ref<string | null>(null);
const fieldReferenceOpen = ref(true);

const statementOpen = ref(false);
const statementAccountId = ref('');
const statementMapping = ref({ ...DEFAULT_COLUMN_MAPPING });
const statementInput = ref<HTMLInputElement | null>(null);
const statementSummary = ref<StatementImportSummary | null>(null);

watch(statementAccountId, () => {
  statementSummary.value = null;
  clearError();
});

// Name may be blank (no name-like column); date and amount are required.
const statementReady = computed(
  () =>
    statementAccountId.value !== '' &&
    statementMapping.value.date.trim() !== '' &&
    statementMapping.value.amount.trim() !== '' &&
    statementSummary.value === null
);

function toggleStatementPanel(): void {
  statementOpen.value = !statementOpen.value;
  statementSummary.value = null;
}

function accountName(accountId: string): string {
  return (
    config.value?.accounts.find(a => a.id === accountId)?.name ?? accountId
  );
}

async function onStatementSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file && statementReady.value) {
    statementSummary.value = await importStatement(
      file,
      statementAccountId.value,
      statementMapping.value
    );
  }
  input.value = '';
}

function toggleExample(name: string): void {
  expandedExample.value = expandedExample.value === name ? null : name;
}

/** Splits backtick-delimited text so field names render as code. */
function segments(text: string): Array<{ code: boolean; text: string }> {
  return text
    .split('`')
    .map((part, i) => ({ code: i % 2 === 1, text: part }))
    .filter(segment => segment.text.length > 0);
}

async function onFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file && (await importFile(file))) emit('close');
  input.value = '';
}

const FIELD_REFERENCE: Array<{
  name: string;
  description: string;
  values?: string[];
  example?: string;
}> = [
  {
    name: 'accounts[].type',
    description: 'What kind of account this is.',
    values: ['checking', 'savings', 'credit', 'cash', 'investment', 'other'],
    example: `{
  "id": "bills-checking",
  "name": "Bills Checking",
  "type": "checking",
  "currency": "EUR",
  "anchor": { "date": "2026-07-01", "balance": 2900.00 }
}`,
  },
  {
    name: 'accounts[].anchor',
    description:
      'A balance you know to be true at the END of a `date`. Every other day is computed forward and backward from here — update it whenever you reconcile with your bank.',
    example: `"anchor": {
  "date": "2026-07-01",
  "balance": 2900.00
}`,
  },
  {
    name: 'accounts[].currency',
    description:
      'ISO 4217 code like `EUR` or `USD`. Accounts in different currencies get their own ledger tab. Defaults to `meta.baseCurrency`.',
  },
  {
    name: 'rules[].recurrence.frequency',
    description: 'How often the rule fires.',
    values: [
      'daily',
      'weekly',
      'biweekly',
      'semimonthly',
      'monthly',
      'quarterly',
      'yearly',
    ],
  },
  {
    name: 'rules[].recurrence',
    description:
      '`start` is the first occurrence (and anchors weekly/biweekly cycles); `end` (optional) is the last allowed date. Monthly and up accept `dayOfMonth`: a number 1–31 (clamped to short months) or `"last"`. Semimonthly uses `days`.',
    example: `// monthly on the last day, ending mid-2027
"recurrence": {
  "frequency": "monthly",
  "start": "2026-07-31",
  "end": "2027-06-30",
  "dayOfMonth": "last"
}

// on the 1st and 15th of every month
"recurrence": {
  "frequency": "semimonthly",
  "start": "2026-07-01",
  "days": [1, 15]
}`,
  },
  {
    name: 'amount',
    description:
      'Signed, in the account’s currency: positive = money in (credit), negative = money out (debit). Same on `rules` and `entries`.',
    example: `// income (credit), recurring
{
  "id": "paycheck",
  "name": "Paycheck",
  "amount": 2400.00,
  "accountId": "usd-checking",
  "recurrence": { "frequency": "biweekly", "start": "2026-07-03" }
}

// expense (debit), one-time
{
  "id": "repair",
  "name": "Appliance repair",
  "amount": -85.00,
  "accountId": "eur-joint-wants",
  "date": "2026-07-22"
}`,
  },
  {
    name: 'from / to / toAmount',
    description:
      'Make a rule or entry a transfer by giving `from` and `to` account ids with a positive `amount` (taken from the `from` account). If the accounts use different currencies, set `toAmount` to the exact amount received; otherwise it is converted via `meta.fxRates`.',
    example: `// same currency: amount leaves "from", arrives at "to"
{
  "id": "sweep",
  "name": "Savings sweep",
  "amount": 250.00,
  "from": "eur-joint-needs",
  "to": "eur-savings",
  "recurrence": { "frequency": "monthly", "start": "2026-07-16" }
}

// cross-currency: toAmount is what actually landed
{
  "id": "fx",
  "name": "USD → EUR transfer",
  "amount": 1500.00,
  "toAmount": 1372.50,
  "from": "usd-checking",
  "to": "eur-bills",
  "recurrence": { "frequency": "monthly", "start": "2026-07-04" }
}`,
  },
  {
    name: 'meta.baseCurrency / meta.fxRates',
    description:
      'Optional. `fxRates` maps a currency to how much base currency 1 unit is worth. Only used for the "All" overview tab and cross-currency transfers without `toAmount` — rates are never fetched, you maintain them.',
    example: `// The rate answers: 1 USD = how many EUR?
// Trackers like Wise usually quote the reverse
// (1 EUR = 1.1415 USD), so invert it:
//   1 / 1.1415 ≈ 0.876
"meta": {
  "name": "Personal",
  "baseCurrency": "EUR",
  "fxRates": { "USD": 0.876 }
}`,
  },
  {
    name: 'overrides[]',
    description:
      'Adjust one occurrence of a rule without changing the rule. Key it with `ruleId` and the original occurrence `date`, then set any of: `skip`, `amount`, `toAmount`, `moveTo`, or `name`. The Adjust/Skip buttons in the ledger write these for you.',
    example: `// skip one occurrence
{ "ruleId": "streaming", "date": "2026-08-12", "skip": true }

// change one occurrence's amount (expense)
{ "ruleId": "utilities", "date": "2026-07-15", "amount": -260.00 }

// income works too: double one salary occurrence
// (e.g. a catch-up payment for a missed month)
{ "ruleId": "paycheck", "date": "2026-08-25", "amount": 4800.00 }

// move one occurrence to another date
{ "ruleId": "rent", "date": "2026-10-01", "moveTo": "2026-10-03" }`,
  },
];
</script>
