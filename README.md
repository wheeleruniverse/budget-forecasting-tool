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

## Privacy Model

Financial data is sensitive, so **only the shape of the data is committed** —
never real values:

- The app ships with [`public/budget-template.json`](public/budget-template.json),
  a sample dataset that demonstrates every feature. It loads automatically on
  first visit (the header shows a **Sample Data** badge) so you can explore
  before uploading anything.
- Download the template, replace the sample values with your own, and keep the
  file anywhere **outside this repo** (or name it `*.budget.json`, which is
  gitignored).
- Upload your JSON at the start of a session. It is parsed in the browser and
  held in memory only — **no API calls, no storage, no tracking**. Refresh the
  page and it's gone.
- If you change data in the app (adjust an occurrence, add a rule, import a
  statement), use **Export JSON** to download the updated file and overwrite
  your copy. The **Data** button flags unsaved in-app changes.

All of this lives in the **Data** dialog in the header, which also documents
every field and enum value so you never have to read source code to write
valid JSON.

Maintain one JSON file per context (e.g. `personal.budget.json` and
`business.budget.json`) and upload whichever one you want to work with.

## Multiple Currencies

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
| **Entry**    | A one-time credit, debit, or transfer on a specific date. Imported statement rows land here.                    |
| **Transfer** | A movement with `from` and `to` accounts. Drill into a day to see the debit on one account and the credit on the other. |
| **Override** | Adjusts a single occurrence of a rule: change its amount, move its date, or skip it entirely.                   |

Balances are derived from each account's anchor: activity after the anchor
accumulates forward, and activity before it is walked backward, so any date has
a defined expected balance. Amounts are signed — positive is money in, negative
is money out. Transfers use a positive amount with `from`/`to` instead of
`accountId`. All arithmetic runs in integer cents.

## Using the Ledger

- **Focus date** — the question the app answers: "what should my balances be
  on this date?" Days behind the focus date are shaded differently from days
  ahead of it, and a summary strip shows every account's expected balance.
- **Daily ledger** — one row per day with activity, showing the end-of-day
  balance of every account side by side. Click a row to drill into that day's
  credits and debits, and to **Adjust** or **Skip** a single occurrence of a
  recurring rule.
- **Load earlier / later** — the projection window is endless; extend it in
  either direction, then use **Hide earlier / later** to collapse it back, or
  jump anywhere with the focus date picker.
- **Manage** — edit accounts, rules, and entries in the app instead of editing
  JSON by hand. Remember to export afterwards.
- **Categories** — see recorded spending binned by category for one account.

## Categories

The **Categories** tab bins one account's recorded spending by its `category`
field, so you can see where the money actually went.

- **Recorded spending only.** Rule-generated occurrences are a forecast, not
  history, so they are excluded — this tab answers "where did it go", while the
  Ledger answers "where will it go".
- **Transfers are excluded.** A movement between two of your own accounts is
  not spending, and its category is copied onto both legs, so counting it would
  net roughly zero while inflating the line count.
- **One account at a time**, over a 1/3/6/12-month trailing range. Amounts stay
  in the account's own currency — nothing is FX-converted here.
- **Category matching is forgiving.** `Food`, `food ` and `FOOD` bin together;
  the first spelling seen becomes the label.
- **Untagged spending is grouped by entry name.** Some statements carry no
  category at all, so untagged entries bin by name instead — repeated merchants
  collapse into one row tagged **by name**. These are provisional groupings,
  not categories you set, and the **Untagged** headline keeps reporting the
  whole gap regardless of how it is split up. Untick **Group untagged spending
  by name** to see it as a single lump.
- **Bulk retagging, one bin or many.** Tick the checkbox on several rows and
  the bulk bar tags all of them in one go — the usual case, because banks split
  a single merchant across store numbers (`Albert Heijn 1503`, `Albert Heijn
  2207`, …) and every one of those is its own bin. **Assign** on a single row
  still opens that bin's entries individually when you need to untick one.
  **Clear category instead** reverses a mis-tag. Changes are in-memory like
  every other edit — export to keep them.
- **Sort by name to find the groups.** The **Bin** and **Spent** column headers
  both sort. Name sorting is case- and number-aware, so `KRUIDVAT 6214` and
  `Kruidvat 1384` land next to each other, ready to select together. The ranked
  chart always stays ordered by amount regardless of the table's sort.

If an account's CSV *does* carry a category column, adding
`"category": "${Category}"` to its `import.rules` shapes tags future imports
automatically and skips the manual pass entirely.

Charts are Chart.js and load only when you open the tab. Every plotted value is
also in the table below, so nothing is reachable by hover alone.

## Importing Bank Statements

The **Data** dialog's **Upload statement** panel imports bank CSV exports as
**one-time entries** on a single account. Select as many files as you like in
one go — they are imported in order against the same account and column
mapping, and each file is applied before the next is read, so duplicate
detection covers the whole batch. There are two ways to map columns:

- **Manual mapping** — tell it which columns hold the date, amount, and
  (optional) name, plus a [date-fns](https://date-fns.org/docs/format) format
  string for the date column. Every other column is ignored.
- **Import rules** — define `import.rules` on the account in your JSON for
  fully automatic, repeatable mapping. Rows are matched in order and the first
  matching rule's `shape` builds the entry. A rule's `when` block lists
  column→value conditions (matched case-insensitively with whitespace
  stripped; omit `when` for a catch-all), and `shape` templates the entry with
  `${ColumnName}` interpolation. Rules can turn matching rows into transfers
  (`from`/`to`/`toAmount`) — for example, routing an internal transfer by
  matching a payee column against a known account `iban`.

Importing never double-counts against your recurring rules: each imported file
advances `meta.forecastFrom` to the day after the latest imported entry, and
rules only generate occurrences **on or after** that date. Occurrences before
it are expected to already exist as imported entries. Every row is added, so
overlapping statements can create duplicates (same account, date, amount, and
name); the importer flags them and you can delete the extras from the ledger
day view or the Manage page. If one file in a batch yields nothing, the rest
still import and the summary names the one that came up empty.

The Data dialog's field reference documents `import` and every other field in
full, with copyable examples.

## Scenarios

The [`scenarios/`](scenarios) directory holds self-contained example datasets —
fully fictional budget JSON and matching statement CSVs — for exploring the app
and walking through features like rule-based import. Each scenario has its own
README explaining how to run it and what it demonstrates.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # vitest watch mode
pnpm build:clean  # format + lint + typecheck + test + build
```

## JSON Schema Quick Reference

```jsonc
{
  "version": 1,
  "meta": {
    "name": "Personal",
    "baseCurrency": "EUR", // totals on the "All" tab are reported in this
    "fxRates": { "USD": 0.92 }, // units of base per 1 USD; maintained by hand
    "forecastFrom": "2026-07-26" // required; rules only fire on/after this; auto-advances on import
  },
  "accounts": [
    {
      "id": "bills-checking",
      "name": "Bills Checking",
      "type": "checking", // checking | savings | credit | cash | investment | other
      "currency": "EUR", // optional; defaults to baseCurrency
      "iban": "NL00BANK0000000000", // optional; used for cross-account matching in import rules
      "anchor": { "date": "2026-07-01", "balance": 3250.0 },
      "import": {
        // optional CSV import config; see the in-app field reference for the full shape
        "dateFormat": "dd-MM-yyyy",
        "rules": [
          {
            "when": { "Type": "TRANSFER", "Payee Account Number": "NL00BANK0000000000" },
            "shape": { "id": "${Ref}", "date": "${Date}", "name": "${Description}", "amount": "${Amount}", "to": "personal-savings" }
          },
          { "shape": { "id": "${Ref}", "date": "${Date}", "name": "${Description}", "amount": "${Amount}" } }
        ]
      }
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
        "start": "2026-07-01", // first occurrence; optional for daily, semimonthly, and monthly with dayOfMonth
        "end": "2027-06-01", // optional; omit for endless
        "dayOfMonth": 1, // number or "last"; defaults to the day from start
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
      "recurrence": { "frequency": "monthly", "dayOfMonth": 2 } // no start: already running
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

## License

Released under the [MIT License](LICENSE) — free to use, copy, modify, and
distribute, with no warranty and no liability. This is a personal side project,
maintained on a best-effort basis; verify your own numbers and keep your own
backups.
