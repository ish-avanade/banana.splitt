# AI "Add" button drops currency — expense saved in trip base currency instead of original

**Type:** bug
**Priority:** high

## Description
When the AI expense parser detects a currency different from the trip's base currency (e.g. user says "$300" on a GBP trip), the AI card correctly shows "US$300.00" with a "⚠ Currency: USD (trip uses GBP)" warning badge. However, pressing the **Add** button saves the expense as £300.00 GBP instead of preserving the original USD currency and fetching the conversion rate — losing the currency context entirely.

Expenses added via the manual form with a different currency correctly store `originalCurrency`, `originalAmount`, and `convertedAmount`, showing the converted amount with an "≈ £227.78" annotation. The AI "Add" flow skips this entirely.

## Current Behavior
1. AI parses "Alena paid $300 for biscuits" → card shows US$300.00 with currency mismatch warning
2. User clicks "Add"
3. Expense is POSTed with `amount: 300` and no currency fields
4. Backend saves it as £300.00 GBP (trip currency) — **wrong**
5. No conversion annotation shown on the saved expense

## Desired Behavior
1. AI parses "Alena paid $300 for biscuits" → card shows US$300.00 with currency mismatch warning (already works)
2. User clicks "Add"
3. Frontend detects `parsed.currency !== trip.currency`, fetches the conversion rate from Frankfurter API
4. Expense is POSTed with `amount: <convertedAmount>`, `originalCurrency: "USD"`, `originalAmount: 300`, `convertedAmount: <convertedAmount>`
5. Saved expense displays as "US$300.00 (≈ £227.78)" — same as manually-added multi-currency expenses

## Acceptance Criteria
- [ ] Clicking "Add" on an AI card where `parsed.currency` differs from `trip.currency` fetches the conversion rate before saving
- [ ] The POSTed expense includes `originalCurrency`, `originalAmount`, and `convertedAmount` fields
- [ ] The saved expense renders with the original currency amount and a conversion annotation (e.g. "≈ £227.78")
- [ ] If the Frankfurter API is unreachable, show a toast error and don't add the expense (don't silently save in the wrong currency)
- [ ] When `parsed.currency` matches `trip.currency`, behavior is unchanged (no conversion needed)

## Implementation Hints

### Frontend (`public/js/app.js`) — `renderAiExpenseCard()` (line ~1008)

The "Add" button click handler currently does:
```js
await post(`/trips/${tripId}/expenses`, {
  description:   parsed.description,
  amount:        parsed.amount,
  paidBy:        parsed.paidBy,
  splitBetween:  parsed.splitBetween,
  date:          parsed.date,
});
```

It needs to check `parsed.currency` against `trip.currency`. When they differ:

1. Fetch conversion from Frankfurter API (same pattern used in `showAddExpenseModal` around line ~804):
   ```js
   const url = `https://api.frankfurter.dev/v1/${parsed.date}?from=${parsed.currency}&to=${trip.currency}&amount=${parsed.amount}`;
   const res = await fetch(url);
   const data = await res.json();
   const convertedAmount = Math.round(data.rates[trip.currency] * 100) / 100;
   ```
2. POST the expense with conversion fields:
   ```js
   await post(`/trips/${tripId}/expenses`, {
     description:    parsed.description,
     amount:         convertedAmount,
     paidBy:         parsed.paidBy,
     splitBetween:   parsed.splitBetween,
     date:           parsed.date,
     originalCurrency: parsed.currency,
     originalAmount:   parsed.amount,
     convertedAmount:  convertedAmount,
   });
   ```

- Show a brief loading state on the Add button during conversion (e.g. `btn.textContent = '…'`)
- Wrap in try/catch — if conversion fails, `toast('Could not fetch currency conversion', 'error')` and abort

### No backend changes needed
The `POST /api/trips/:id/expenses` endpoint (line ~241) already accepts and stores `originalCurrency`, `originalAmount`, and `convertedAmount`. The expense list rendering (line ~356) already handles the conversion annotation display.

## Testing
- Create a GBP trip, use AI chat: "Alice paid $300 for biscuits"
- Press Add → verify expense saves with originalCurrency=USD, shows "US$300.00 (≈ £…)" 
- Create a GBP trip, use AI chat: "Alice paid £50 for taxi" (same currency)
- Press Add → verify no conversion, saves as £50.00 normally
- Disable network → use AI chat with different currency → press Add → verify toast error, expense not saved
