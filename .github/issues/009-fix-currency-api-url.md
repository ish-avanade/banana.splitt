# Currency conversion API calls fail — missing /v1/ path prefix

**Type:** bug
**Priority:** high

## Description
The Frankfurter API calls for historical currency conversion always fail with a 404, causing the "Could not fetch rate — will use 1:1" error message. The root cause is a missing `/v1/` path segment in the API URL.

## Current Behavior
- Selecting a foreign currency in the expense form shows "Could not fetch rate — will use 1:1"
- The toast "Exchange rate unavailable — using 1:1 conversion" appears on submit
- All cross-currency expenses are saved with a 1:1 rate, making balances incorrect

## Root Cause
The code calls `https://api.frankfurter.dev/{date}?from=...` but the API requires `https://api.frankfurter.dev/v1/{date}?from=...`. The `/v1/` prefix is mandatory — without it, the API returns `{"status":404,"message":"not found"}`.

**Verified:**
- `https://api.frankfurter.dev/2023-04-14?from=USD&to=GBP&amount=200` → 404
- `https://api.frankfurter.dev/v1/2023-04-14?from=USD&to=GBP&amount=200` → `{"amount":200.0,"base":"USD","date":"2023-04-14","rates":{"GBP":159.97}}`

## Desired Behavior
- Currency conversion fetches succeed and show the live preview (e.g. "≈ £159.97 at 0.7999 rate")
- Expenses are saved with the correct converted amount
- Balances reflect accurate exchange rates

## Acceptance Criteria
- [ ] All Frankfurter API URLs in `public/js/app.js` use the `/v1/` path prefix
- [ ] Live conversion preview works when selecting a foreign currency
- [ ] Expense submission uses the fetched rate (not 1:1 fallback)
- [ ] Existing fallback behavior still works if the API is genuinely down

## Implementation Hints
- **File**: `public/js/app.js`
- **Lines to fix**: There are exactly 2 URL constructions to update:
  1. In `updateConversionPreview()` (~line 736): change `https://api.frankfurter.dev/${date}?` to `https://api.frankfurter.dev/v1/${date}?`
  2. In the expense form submit handler (~line 800): same fix
- This is a one-line-per-occurrence fix — no logic changes needed
- No backend changes required

## Testing
- Create a trip with GBP currency
- Add an expense, select USD as the expense currency, enter an amount
- Verify the preview shows the converted amount (e.g. "≈ £159.97 at 0.7999 rate")
- Submit and verify the expense list shows the original + converted amounts
- Check balances are calculated in the trip's base currency
