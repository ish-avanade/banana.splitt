---
name: expense-validation
description: "Conventions and rules for duplicate and anomaly detection in the banana/splitt expense form. Load this skill when implementing or modifying expense validation, duplicate warnings, or anomaly checks."
---

# Expense Validation — Skill

> Conventions and rules for duplicate and anomaly detection in banana/splitt.
> Load this skill when implementing or modifying expense validation, duplicate warnings, or anomaly checks in the expense form.

## Overview

The `runChecks` function (inside `attachExpenseFormHandlers` in `public/js/app.js`) fires on every `input`/`blur`/`change` event on the expense form's amount, description, and date fields. It shows a dismissible warning banner (`#expense-warning`) when either a duplicate or an anomalously large expense is detected.

## Rule 1 — Bidirectional Description Substring Match

A duplicate is only meaningful when the descriptions are related. Either the existing description may be a prefix/substring of the new one, or vice versa.

```js
// CORRECT — bidirectional match
(e.description.toLowerCase().includes(descLower) ||
 descLower.includes(e.description.toLowerCase()))

// WRONG — one-directional (misses "Dinner at restaurant" when "Dinner" already exists)
e.description.toLowerCase().includes(descLower)
```

### Rationale
- Typing `"Dinner at restaurant"` when `"Dinner"` already exists: `descLower` does **not** contain the existing shorter string unless we also check the reverse.
- The bidirectional check catches both cases without adding false positives for completely unrelated descriptions.

## Rule 2 — Currency-Normalised Amount Comparison

`trip.expenses` stores amounts already converted to the **trip base currency**. The raw `amountEl.value` is entered in the expense's own (possibly foreign) currency. Comparing raw foreign-currency amounts against stored trip-currency amounts produces false negatives.

### DOM Elements

| Element | ID | Purpose |
|---|---|---|
| Amount input | `#exp-amount` | Raw input in the selected currency |
| Currency selector | `#exp-currency` | The expense's currency (may differ from `trip.currency`) |
| Conversion preview | `#conversion-preview` | Text label showing the converted amount |

The variable `lastConvertedAmount` (declared in the closure of `attachExpenseFormHandlers`) holds the most recently computed converted value (number) from `updateConversionPreview`. It is `null` when no conversion has run yet, but is initialized from `expense.convertedAmount` when editing a foreign-currency expense so that `runChecks` has a correct value before the user triggers a live fetch.

`updateConversionPreview` always calls `runChecks()` on completion (success or failure) to keep the warning banner in sync with the latest converted amount.

```js
// Derive the trip-currency comparable amount — fallback chain:
// live conversion → saved expense conversion → raw input amount
const isForeignCurrency = expCurrency && expCurrency !== trip.currency;
const savedConvertedAmount = expense && typeof expense.convertedAmount === 'number'
  ? expense.convertedAmount
  : null;
let compareAmount = amount;
if (isForeignCurrency) {
  if (lastConvertedAmount !== null) {
    compareAmount = lastConvertedAmount;
  } else if (savedConvertedAmount !== null) {
    compareAmount = savedConvertedAmount;
  }
}
```

Use `compareAmount` (not raw `amount`) on **both sides** of:
- The duplicate amount check (`Math.abs(e.amount - compareAmount) / Math.max(e.amount, compareAmount) < 0.05`)
- The anomaly check (`compareAmount > avg * 5`)

## Thresholds

| Check | Threshold | Rationale |
|---|---|---|
| Duplicate amount match | ±5% relative difference | Accommodates rounding/minor price differences while catching true duplicates |
| Anomaly detection | > 5× average of existing expenses | Flags data-entry errors (e.g. entered 5000 instead of 50) without being too sensitive for legitimate large expenses |

## Edge Cases

| Scenario | Behaviour |
|---|---|
| First expense (no comparisons) | Skip anomaly check — `comparisons.length === 0` guard |
| Editing an existing expense | Exclude the expense being edited from `comparisons` using `trip.expenses.filter((e) => e.id !== expense.id)` to avoid false self-match |
| Empty description | Skip the duplicate description check entirely (`desc.length > 0` guard) |
| Amount ≤ 0 or NaN | Hide warning and return early |
| Foreign currency, conversion not yet fetched (`lastConvertedAmount === null`) | Fall back to raw `amount` — avoids blocking the user while the rate is loading |

## Warning Banner

The warning banner is shown/hidden by toggling the `hidden` CSS class:

```js
warningEl.classList.remove('hidden');  // show
warningEl.classList.add('hidden');     // hide
```

- `#expense-warning` — the container element
- `#expense-warning-text` — where the message is set via `.textContent`
- `#expense-warning-dismiss` — the dismiss button (adds `hidden` on click)

Always set `warningTextEl.textContent` (not `.innerHTML`) to avoid XSS from user-supplied description strings.
