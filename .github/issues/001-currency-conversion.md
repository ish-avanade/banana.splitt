# Historical Currency Conversion

**Type:** feature
**Priority:** high

## Description
When a trip involves expenses in different currencies, automatically convert amounts to the trip's base currency using the historical exchange rate for the expense date. This helps groups traveling internationally see accurate balances without manual math.

## Current Behavior
- Trips have a single `currency` field
- All expenses are assumed to be in the trip currency
- No way to record expenses in a foreign currency

## Desired Behavior
- Each expense can optionally specify a different currency than the trip's default
- When a foreign currency is used, the app fetches the exchange rate for that expense's date from the Frankfurter API (`https://api.frankfurter.dev`)
- The expense stores both the original amount/currency and the converted amount in the trip's base currency
- The expenses list shows both: e.g. "€45.00 (≈ $49.12)"
- Balances are always calculated in the trip's base currency
- The conversion rate is stored on the expense so it doesn't need to be re-fetched

## Acceptance Criteria
- [ ] Expense form has an optional currency selector (defaults to trip currency)
- [ ] When a different currency is selected, the exchange rate is fetched from `https://api.frankfurter.dev/{date}?from={expCurrency}&to={tripCurrency}&amount={amount}`
- [ ] Expense object stores `originalCurrency`, `originalAmount`, and `convertedAmount` alongside existing `amount` field
- [ ] `amount` field always holds the value in trip base currency (for balance calculations)
- [ ] Expense list shows original amount with conversion note when currencies differ
- [ ] Exchange rate fetch errors show a toast and don't block expense creation (fall back to manual entry or 1:1 rate)
- [ ] Edit expense preserves original currency info
- [ ] API tests cover creating an expense with a foreign currency

## Implementation Hints
- **Backend** (`server.js`): The expense creation/update endpoints should accept optional `originalCurrency` and `originalAmount` fields. If present, store them. The `amount` field remains the trip-currency value (frontend does conversion before sending, or backend does it).
- **Frontend** (`public/js/app.js`): In `expenseModalHTML()`, add a currency selector next to the amount field. When it differs from `trip.currency`, fetch the rate from Frankfurter API and compute converted amount. Show a small preview: "≈ $49.12 at 1.091 rate".
- **Frontend** (`public/js/app.js`): In `renderExpensesTab()`, show original amount when `originalCurrency` exists.
- **API**: Frankfurter is free, no API key needed. Example: `GET https://api.frankfurter.dev/2024-07-15?from=EUR&to=USD&amount=45`
- **Edge cases**: Same currency (no conversion needed), API down (graceful fallback), future dates (use latest rate), weekend dates (API returns last available).

## Testing
- Create an expense with a foreign currency and verify `originalCurrency`, `originalAmount`, and `amount` are stored correctly
- Verify balance calculations still use the `amount` field (trip currency)
- Test that editing a converted expense preserves the original currency data
