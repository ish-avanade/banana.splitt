# Fix Duplicate & Anomaly Detection Bugs

**Type:** bug
**Priority:** high

## Description
The existing duplicate and anomaly detection in the expense form (`checkAndUpdateTripDates` / `attachExpenseFormHandlers`) has two silent bugs that cause it to miss real duplicates and produce false positives for multi-currency expenses.

## Current Behavior

### Bug 1 — One-directional description match (app.js ~line 1497)
The duplicate check only tests whether the **existing** expense description contains the **new** one:
```js
e.description.toLowerCase().includes(descLower)
```
This means typing `"Dinner at restaurant"` when `"Dinner"` already exists produces **no warning** because `"dinner"` does not contain `"dinner at restaurant"`. The shorter string must also be checked against the longer one.

### Bug 2 — Raw amount compared against converted amount (app.js ~line 1493)
`trip.expenses` stores amounts already converted to the **trip base currency**, but `amountEl.value` is the **raw input** in the expense's own foreign currency. On a EUR trip, entering `50` (USD) compares against `46.20` (the stored EUR amount), giving a `7.8%` difference — above the 5% threshold — so the duplicate is silently missed. The check should compare against `rawAmount * conversionRate` (the already-computed `convertedAmount`) or compare stored amounts only.

## Desired Behavior
- Duplicate check uses a **bidirectional** description substring match
- Amount comparison uses the **trip-currency amount** (post-conversion) on both sides
- No false negatives for multi-currency expenses
- No false positives from one-directional string matching

## Acceptance Criteria
- [ ] Entering "Dinner at restaurant" warns when "Dinner" already exists for same date/amount
- [ ] Entering "Dinner" warns when "Dinner at restaurant" already exists for same date/amount
- [ ] Adding a USD expense on a EUR trip correctly compares converted EUR amounts
- [ ] Warnings still don't appear when editing the expense against itself
- [ ] Anomaly threshold (5× average) compares trip-currency amounts on both sides
- [ ] A `SKILL.md` for `expense-validation` is created documenting the comparison rules as a reusable skill

## Implementation Hints

### Files to modify
- `public/js/app.js` — `runChecks` function inside `attachExpenseFormHandlers()` (~line 1479)

### Fix 1 — Bidirectional description match
```js
// Replace:
e.description.toLowerCase().includes(descLower)
// With:
(e.description.toLowerCase().includes(descLower) ||
 descLower.includes(e.description.toLowerCase()))
```

### Fix 2 — Currency-normalised amount comparison
The form already computes `convertedAmount` for the preview (see `updateConversionPreview`). Read the stored `data-converted` value from the conversion preview element, or re-derive it:
```js
// Use the converted amount if a foreign currency is selected; otherwise use the raw amount
const expCurrency = document.getElementById('exp-currency').value;
const compareAmount = (expCurrency && expCurrency !== trip.currency)
  ? parseFloat(document.getElementById('conv-preview').dataset.converted || amount)
  : amount;
```
Then compare `compareAmount` against `e.amount` in the duplicate check and in the anomaly average.

### Create skill
Create `.github/skills/expense-validation/SKILL.md` documenting:
- Both comparison rules (bidirectional string, currency normalisation)
- Which DOM elements hold the converted value
- The 5% duplicate threshold and 5× anomaly threshold with rationale
- Edge cases: first expense (skip anomaly), editing (exclude self)

## Testing
- Add a USD expense (e.g. $50) on a EUR trip where a €46 expense with the same description exists on the same date → warning should appear
- Type "Lunch at bistro" when "Lunch" already exists → warning should appear
- Type "Lunch" when "Lunch at bistro" already exists → warning should appear
- Edit an existing expense — verify no false self-match warning
