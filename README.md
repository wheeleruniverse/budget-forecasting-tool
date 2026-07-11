# Budget Forecast

A privacy-first budgeting and forecasting ledger. Pick any date — past or
future — and see what the balance of every account **should** be on that day,
with every credit and debit that gets it there.

Built with the same stack as the other Wheeler Universe apps: Vue 3,
TypeScript, Vite, Tailwind CSS, and Vitest.

> **🖥️ Desktop only.** This app is deliberately designed for large screens.
> The core view is a wide multi-account ledger table, and the upload/export
> workflow (moving JSON files in and out of the browser) is awkward on
> phones. It renders on mobile with a warning, but no effort is spent making
> it comfortable there.

## Privacy model

Financial data is sensitive, so **only the shape of the data is committed** —
never real values:

- The app ships with [`public/budget-template.json`](public/budget-template.json),
  a sample dataset that demonstrates every feature.
- Download the template, replace the sample values with your own, and keep the
  file anywhere **outside this repo** (or name it `*.budget.json`, which is
  gitignored).
- Upload your JSON at the start of a session. It is parsed in the browser and
  held in memory only — **no API calls, no storage, no tracking**. Refresh the
  page and it's gone.
- If you change data in the app (adjust an occurrence, add a rule), use
  **Export JSON** to download the updated file and overwrite your copy.

All of this lives in the **Data** dialog in the header, which also documents
every field and enum value so you never have to read source code to write
valid JSON.

Maintain one JSON file per context (e.g. `personal.budget.json` and
`business.budget.json`) and upload whichever one you want to work with.

## Multiple currencies

Accounts can declare a `currency` (ISO 4217, e.g. `EUR`, `USD`). The ledger
then shows **one tab per currency** — each an exact, same-currency view with
its own total column — plus an optional **All** tab that converts everything
to `meta.baseCurrency` using your hand-maintained `meta.fxRates` (clearly an
estimate; no rates are ever fetched). The All tab only appears when every
currency has a rate.

Money still moves across currencies: a transfer between accounts of different
currencies takes `toAmount` — the exact amount the receiving account got. Its
debit leg shows in one currency's tab and its credit leg in the other. If you
omit `toAmount`, the received amount is derived from `fxRates`.

Note the rate direction: `fxRates` answers *"1 unit of the keyed currency =
how many units of base?"*. Trackers like Wise usually quote the reverse
(1 EUR = 1.1415 USD), so invert it: `"USD": 0.876` (= 1 / 1.1415).

## Concepts

| Concept      | What it is                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| **Account**  | A named bucket of money with a **balance anchor**: a known balance at the end of a specific date.               |
| **Rule**     | A recurring credit, debit, or transfer (`daily`, `weekly`, `biweekly`, `semimonthly`, `monthly`, `quarterly`, `yearly`). |
| **Entry**    | A one-time credit, debit, or transfer on a specific date.                                                       |
| **Transfer** | A movement with `from` and `to` accounts. Drill into a day to see the debit on one account and the credit on the other. |
| **Override** | Adjusts a single occurrence of a rule: change its amount, move its date, or skip it entirely.                   |

Balances are derived from each account's anchor: activity after the anchor
accumulates forward, and activity before it is walked backward, so any date has
a defined expected balance. Amounts are signed — positive is money in, negative
is money out. Transfers use a positive amount with `from`/`to` instead of
`accountId`. All arithmetic runs in integer cents.

## Using the ledger

- **Focus date** — the question the app answers: "what should my balances be
  on this date?" Days behind the focus date are shaded differently from days
  ahead of it, and a summary strip shows every account's expected balance.
- **Daily ledger** — one row per day with activity, showing the end-of-day
  balance of every account side by side. Click a row to drill into that day's
  credits and debits, and to **Adjust** or **Skip** a single occurrence of a
  recurring rule.
- **Load earlier / later** — the projection window is endless; extend it in
  either direction or jump anywhere with the focus date picker.
- **Manage** — edit accounts, rules, and entries in the app instead of editing
  JSON by hand. Remember to export afterwards.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # vitest watch mode
pnpm build:clean  # format + lint + typecheck + test + build
```

## JSON schema quick reference

```jsonc
{
  "version": 1,
  "meta": {
    "name": "Personal",
    "baseCurrency": "EUR", // totals on the "All" tab are reported in this
    "fxRates": { "USD": 0.92 } // units of base per 1 USD; maintained by hand
  },
  "accounts": [
    {
      "id": "bills-checking",
      "name": "Bills Checking",
      "type": "checking", // checking | savings | credit | cash | investment | other
      "currency": "EUR", // optional; defaults to baseCurrency
      "anchor": { "date": "2026-07-01", "balance": 3250.0 }
    }
  ],
  "rules": [
    {
      "id": "mortgage",
      "name": "Mortgage",
      "amount": -1850.0, // negative = debit, positive = credit
      "category": "housing",
      "accountId": "bills-checking",
      "recurrence": {
        "frequency": "monthly", // daily | weekly | biweekly | semimonthly | monthly | quarterly | yearly
        "start": "2026-07-01", // first occurrence; anchors weekly/biweekly cycles
        "end": "2027-06-01", // optional; omit for endless
        "dayOfMonth": 1, // optional; number or "last"
        "days": [1, 15] // semimonthly only
      }
    },
    {
      "id": "sweep",
      "name": "Savings sweep",
      "amount": 500.0, // transfers are always positive, in the "from" currency
      "from": "bills-checking",
      "to": "personal-savings",
      "toAmount": 543.5, // cross-currency only: exact amount received
      "recurrence": { "frequency": "monthly", "start": "2026-07-02" }
    }
  ],
  "entries": [
    {
      "id": "car-repair",
      "name": "Car repair",
      "date": "2026-07-22",
      "amount": -650.0,
      "accountId": "bills-checking"
    }
  ],
  "overrides": [
    { "ruleId": "mortgage", "date": "2026-08-01", "amount": -1900.0 },
    { "ruleId": "sweep", "date": "2026-09-02", "skip": true },
    { "ruleId": "mortgage", "date": "2026-10-01", "moveTo": "2026-10-03" }
  ]
}
```
