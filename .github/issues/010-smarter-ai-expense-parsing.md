# Smarter AI Expense Parsing — Flexible Defaults & Auto-Member Creation

**Type:** improvement
**Priority:** high

## Description
The AI expense parser (`POST /api/trips/:id/parse-expense`) is too strict about the information it requires. Users expect natural, conversational input like _"Ish paid 20 euros for food"_ to just work — but today the parser fails or returns empty results when:
- A currency name is written out ("euros", "dollars", "yen") instead of using the trip's currency code
- No date is provided
- The payer or split members are not existing trip participants
- No split members are explicitly mentioned

The system prompt and post-processing logic need to be more forgiving and apply sensible defaults.

## Current Behavior
1. **Currency names not interpreted** — saying "20 euros" doesn't map to `EUR`/`€`; the AI may reject it or use the wrong currency.
2. **Missing date → today** — this works, but if the trip already has expenses the user likely means the same day as the most recent expense.
3. **Unknown participant names → `paidBy: null`** — the "Add" button then refuses with _"Could not match all participant names"_. The user has to manually create the member first.
4. **No split members mentioned → empty array** — same failure. If no split is specified, it should default to an even split among all trip participants.

## Desired Behavior
1. **Currency word → symbol/code mapping**: The system prompt should instruct the AI to interpret written currency names (e.g. "euros" → EUR, "dollars" → USD, "pounds" → GBP, "yen" → JPY, "rupees" → INR, etc.) and return the amount as a plain number. If the detected currency matches the trip's base currency, proceed normally. If it doesn't match, include a `currency` field in the returned JSON so the frontend can flag a mismatch. If the currency is ambiguous or absent, default to the trip's base currency.
2. **Smarter default date**: If the user doesn't specify a date, use the date of the most recent expense on the trip. If there are no expenses yet, fall back to today's date. Pass the most recent expense date into the system prompt as context.
3. **Auto-create unknown participants**: When `findParticipant()` returns `null` for a `paidBy` or `splitBetween` name, automatically add that person as a new participant on the trip (generate a UUID, push into `trip.participants`, persist). Return the new participant's ID as normal.
4. **Default even split**: Instruct the AI that if no specific split members are mentioned, it should return all current participant names (including any newly added payer) in `splitBetween`. Update the system prompt accordingly.
5. **Never return empty array for a clear expense**: Tighten the prompt so the AI only returns `[]` if the message is truly not an expense (e.g. "hello"). A message like "Ish paid 20 for food" has enough info to produce a result.

## Acceptance Criteria
- [ ] "Ish paid 20 euros for food" on a EUR trip → parses correctly with amount 20, currency EUR
- [ ] "Ish paid 20 dollars for food" on a EUR trip → parses with amount 20, includes `currency: "USD"` so frontend can flag mismatch
- [ ] "Ish paid 20 for food" with no date → uses the date of the most recent expense, or today if no expenses exist
- [ ] "Ish paid 20 for food" where "Ish" is not a participant → auto-creates "Ish" as a participant, returns valid `paidBy` ID
- [ ] "Ish paid 20 for food" with no split mentioned → defaults to splitting among all participants (including "Ish")
- [ ] Unknown split members like "Max paid 20 for food split with Ish and Tina" → auto-creates any unknown names as participants
- [ ] Existing fuzzy matching still works (partial names, case-insensitive)
- [ ] The "Add" button works without requiring manual edits for the above scenarios
- [ ] API tests cover the new default behaviors

## Implementation Hints

### Backend (`server.js`) — `POST /api/trips/:id/parse-expense` (line ~414)

**System prompt changes** (line ~434):
- Add the most recent expense date to the prompt context:
  ```js
  const lastExpenseDate = trip.expenses?.length
    ? trip.expenses.sort((a, b) => b.date.localeCompare(a.date))[0].date
    : today;
  ```
  Then in the prompt: `- Default date (if not specified): ${lastExpenseDate}`
- Add currency interpretation instructions: _"If the user writes a currency name like 'euros', 'dollars', 'pounds', interpret it as the ISO currency code. Include a `currency` field in each expense object (e.g. 'EUR', 'USD'). If no currency is mentioned, use the trip's default: ${trip.currency}."_
- Add default split instruction: _"If no split members are specified, assume the expense is split evenly among ALL participants: ${participantNames}."_
- Relax the empty-array rule: _"Only return [] if the message is clearly not an expense. If you can extract a description and amount, return a result using reasonable defaults."_
- Add the `currency` field to the JSON schema the AI returns.

**Auto-create participants** (after `findParticipant`, line ~484):
```js
function findOrCreateParticipant(name) {
  const existing = findParticipant(name);
  if (existing) return existing;
  // Auto-create
  const newParticipant = { id: uuidv4(), name: name.trim() };
  trip.participants.push(newParticipant);
  participantsChanged = true;
  return newParticipant;
}
```
After mapping all expenses, if `participantsChanged`, call `saveData(data)` to persist.

Replace `findParticipant` calls in the expense mapping with `findOrCreateParticipant`.

**Currency field passthrough** (expense mapping, line ~490):
- Include `currency: item.currency || trip.currency` in the returned expense objects so the frontend can detect mismatches.

### Frontend (`public/js/app.js`) — `renderAiExpenseCard()` (line ~979)

- If `parsed.currency` differs from `trip.currency`, show a small warning badge on the card: _"⚠ Currency: USD (trip uses EUR)"_
- Use `parsed.currency` in the `fmt()` call for display if present.

### Tests (`tests/api.test.js`)

Add tests for the parse-expense endpoint:
- Message with written currency name
- Message with no date (check returned date matches last expense date)
- Message with unknown participant name (check participant is created)
- Message with no explicit split (check all participants returned)

## Testing
- Create a trip with currency EUR and participants ["Alice", "Bob"]
- Send: "Ish paid 20 euros for food" → verify Ish is auto-created, amount=20, currency=EUR, split=Alice+Bob+Ish
- Send: "Alice paid 50 dollars for dinner" → verify currency="USD" and warning shown
- Send: "Bob paid 10 for taxi" (no date) → verify date = last expense's date
- Send: "hello how are you" → verify empty array returned
- Verify all new participants persist across page reload
