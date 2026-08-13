# Credit Card with Import Rules

Fully fictional mock data for exercising the credit-card statement import path.
Amounts and dates are representative; every merchant description has been
altered. Do not treat any name here as real.

Files:

- `initial-credit-card-w-import-rules.json` — the starting budget (upload this).
- `mock-credit-card-statement.csv` — the bank statement to import.
- `expected-credit-card-w-import-rules.json` — the post-import end-state, kept
  as a reference. Fully regenerable from the two inputs above (import advances
  `forecastFrom` and appends the statement rows as entries).

## How to Use

1. Open the **Data** dialog and **Upload JSON** →
   `initial-credit-card-w-import-rules.json`.
2. In the same dialog, open **Upload statement**, pick **Mock Credit Card
   (1234)**, then choose `mock-credit-card-statement.csv`.
3. The account's `import.rules` map the columns automatically — no manual
   column mapping needed.
4. Use **Load earlier days** (or the focus-date picker) to scroll back to
   April–July and see the imported history.

## What It Exercises

- **Split Debit/Credit columns.** Rows with an empty `Debit` are matched by
  `{ "Debit": "" }` and take the positive `${Credit}` (payments, refunds,
  rewards). Everything else falls through to the catch-all rule as a negative
  `-${Debit}` (purchases, fees).
- **Messy real-world merchant strings** the importer must pass through intact:
  processor prefixes (`SP `, `CCV*`), collapsed multiple spaces
  (`COMPILE   *EATS`), truncated names (`... SEATT`, `CCV*Rubber Duck D`),
  domain-style names (`LeetEats.io LeetE`), trailing region/ID codes
  (`GITHUB COPILOT US`, `TESLA SUPRCHG U730914500`), and colon/hyphen formats
  (`TECH DEBT CHARGE:PURCHASES`, `CREDIT-AWS PROMO CREDIT`).
- **Same-day, same-merchant refund + purchase** (`COMPILE   *EATS`, one credit
  and one debit) — verifies both rules fire on otherwise-identical rows.
- **Multiple card numbers on one statement** (`1234` and `5678`) — all rows
  import to the single account, as they would on a real combined statement.
- **Recurring rules alongside imported history.** Three rules drive the
  forecast: a card payment transfer from checking (`cc-payment`) plus two
  monthly subscriptions (`software-copilot`, `software-claude`) that match
  imported statement lines (`GITHUB COPILOT US`, `SP ANTHROPIC CLAUDE`). The
  ledger shows forecast occurrences next to the real imported charges.
- **Projected-negative warning.** Checking opens at `1500.00` and only ever
  pays out (the `cc-payment` transfer, no income), so it trends downward. Keep
  projecting forward with **Load later days** and it drops below zero around
  **2026-11-24**, tripping the "Projected negative balances" warning.

  > _The warning only covers non-credit accounts — credit cards are expected to
  > carry a negative balance, so they're excluded._

## Note on Anchor Dates

Both accounts are anchored at **2026-04-01**, before the statement history. This
matters: the ledger can only display days on or after the *earliest* account
anchor, so if the anchors sat in August the April–July imported rows would be
invisible — you couldn't scroll back far enough to reach them. Anchoring at the
statement's opening makes the full history viewable, with balances accumulating
forward from a clean starting point (checking `1500.00`, card `0.00`).

## Note on `forecastFrom`

The statement import advances `meta.forecastFrom` to the day after the latest
imported entry, so the recurring rules only forecast **future** occurrences and
won't double-count against the historical charges you just imported. This budget
ships without `forecastFrom` set, so before importing you'll see the rules
forecast every month back to April; after importing, the real charges replace
those forecast occurrences.
