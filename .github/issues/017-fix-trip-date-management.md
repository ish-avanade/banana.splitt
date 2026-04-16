# Fix Trip Date Management Edge Cases

**Type:** bug
**Priority:** medium

## Description
`checkAndUpdateTripDates` in `app.js` has an unhandled state when a trip has **one date set but not the other**. It also contains non-obvious correctness rules (ISO string comparison, inclusive day counting, timezone normalisation) that are silently broken whenever the code is refactored. A skill should document these rules to prevent regressions.

## Current Behavior

### Bug — Partial dates state not handled (app.js ~line 1653)
The function has two branches:
1. **Neither date set** → auto-set both silently
2. **Both dates set, expense is outside** → prompt user

The missing case: **`startDate` is set but `endDate` is null** (or vice versa). When this happens:
- `noEnd` is `true`, so the `expenseDate > trip.endDate` comparison silently evaluates `expenseDate > null` → `false`
- The end date is **never auto-set or prompted** even though the trip has no end date
- The forecast section remains hidden forever regardless of expenses added

### Non-obvious correctness rules with no documentation
1. `expenseDate < trip.startDate` uses **ISO string comparison** (`"2024-07-10" < "2024-07-15"`) — this is intentional and correct, but any refactor to use `new Date()` objects would cause a UTC timezone bug (midnight UTC parses as the previous day in behind-UTC timezones).
2. Inclusive day count in `renderForecast`: `Math.round((end - start) / MS_PER_DAY) + 1` — the `+ 1` is required; dropping it breaks the day counter by one.
3. `setHours(0, 0, 0, 0)` is **required** in `renderForecast` (Date arithmetic) but **must not** be used in `checkAndUpdateTripDates` (string comparison). Mixing the two approaches causes subtle bugs.

## Desired Behavior
- Partial dates state handled: if one date is set and an expense falls outside it, prompt to update OR auto-derive the missing date from existing expenses
- ISO string comparison rules documented in a skill to prevent refactor regressions
- The three forecast display states (before/during/after trip) have explicit copy and icon rules that are preserved across changes

## Acceptance Criteria
- [ ] When `startDate` is set but `endDate` is null, adding an expense later than `startDate` auto-sets `endDate` (or prompts) rather than silently doing nothing
- [ ] When `endDate` is set but `startDate` is null, adding an expense earlier than `endDate` auto-sets `startDate` (or prompts)
- [ ] Forecast section correctly shows after the partial-dates fix
- [ ] A `SKILL.md` for `trip-dates` is created documenting the ISO string comparison rule, inclusive day count, and the three forecast states with their exact messages/icons
- [ ] Existing full-dates prompt behavior (both dates set, expense outside range) is preserved
- [ ] Auto-set silent behavior (no dates set) is preserved

## Implementation Hints

### Files to modify
- `public/js/app.js` — `checkAndUpdateTripDates` function (~line 1653)

### Fix — Handle partial dates
Add two new branches for the partial states:

```js
// If startDate exists but no end — auto-set endDate from max of all expense dates
if (!noStart && noEnd) {
  const allDates = trip.expenses
    .filter(e => e.id !== editingExpenseId)
    .map(e => e.date).filter(Boolean);
  allDates.push(expenseDate);
  allDates.sort();
  try {
    await put(`/trips/${trip.id}`, { endDate: allDates[allDates.length - 1] });
  } catch (_) { /* non-critical */ }
  onSuccess();
  return;
}

// Symmetric case: endDate exists but no start
if (noStart && !noEnd) {
  const allDates = trip.expenses
    .filter(e => e.id !== editingExpenseId)
    .map(e => e.date).filter(Boolean);
  allDates.push(expenseDate);
  allDates.sort();
  try {
    await put(`/trips/${trip.id}`, { startDate: allDates[0] });
  } catch (_) { /* non-critical */ }
  onSuccess();
  return;
}
```

### Create skill
Create `.github/skills/trip-dates/SKILL.md` documenting:
- The four date states and which code path handles each
- Why ISO string comparison (`"YYYY-MM-DD" < "YYYY-MM-DD"`) is safe and correct — DO NOT refactor to Date objects
- Why `setHours(0,0,0,0)` is required in `renderForecast` but prohibited in `checkAndUpdateTripDates`
- Inclusive day count formula: `Math.round((end - start) / MS_PER_DAY) + 1`
- The three forecast display states with their exact icon, message format, and bar behaviour

## Testing
- Create a trip with only `startDate` set (no `endDate`), add an expense — verify `endDate` is auto-set
- Create a trip with only `endDate` set (no `startDate`), add an expense — verify `startDate` is auto-set
- Verify forecast section now appears for the partial-dates trip after the fix
- Existing tests for `PUT /api/trips/:id` (dates validation) should still pass
- No regression: full-dates prompt behavior unchanged when both dates are set
