---
name: trip-dates
description: "Rules and conventions for trip date management in banana/splitt — ISO string comparison, inclusive day counting, timezone normalisation, and forecast display states. Load this skill when modifying checkAndUpdateTripDates or renderForecast."
---

# Trip Date Management — Skill

> Rules and conventions for trip date management in banana/splitt.
> Load this skill when modifying `checkAndUpdateTripDates` or `renderForecast`.

## Date Storage Format

All trip and expense dates are stored and compared as ISO 8601 date strings: `"YYYY-MM-DD"`.

---

## The Four Date States in `checkAndUpdateTripDates`

`checkAndUpdateTripDates(trip, expenseDate, editingExpenseId, onSuccess)` is called after every expense save. It handles four states:

| `startDate` | `endDate` | Behaviour |
|---|---|---|
| `null` | `null` | **Auto-set both** silently — derive min/max from all expense dates (including the new one). |
| set | `null` | **Auto-set `endDate`** silently — derive max from all expense dates (including the new one). |
| `null` | set | **Auto-set `startDate`** silently — derive min from all expense dates (including the new one). |
| set | set | **Prompt** the user if the expense is outside the range (`< startDate` or `> endDate`). |

The first three states return early after calling `onSuccess()`. The fourth state falls through two independent `if` blocks (one for start, one for end) before calling `onSuccess()`.

---

## ISO String Comparison — DO NOT Refactor to Date Objects

```js
// CORRECT — safe ISO string comparison
if (expenseDate < trip.startDate) { ... }
if (expenseDate > trip.endDate)   { ... }
```

**Why this is correct:** `"YYYY-MM-DD"` strings are zero-padded and sort lexicographically in the same order as calendar dates. This is intentional and well-defined.

**Why `new Date()` is prohibited here:** Parsing `"2024-07-15"` with `new Date("2024-07-15")` creates a UTC midnight timestamp. In any timezone behind UTC (e.g. `America/New_York`, UTC-5), that timestamp represents `2024-07-14 19:00 local` — one day earlier. This causes silent off-by-one bugs in comparisons and is extremely hard to debug.

**Rule:** In `checkAndUpdateTripDates`, always compare dates as strings. Never call `new Date()` on a date string for comparison purposes.

---

## `setHours(0,0,0,0)` — Required in `renderForecast`, Prohibited in `checkAndUpdateTripDates`

`renderForecast` performs **arithmetic** (subtraction, division) on Date objects to count days. For this to work correctly across DST transitions, all three timestamps (`now`, `start`, `end`) must be normalised to midnight in the **local** timezone:

```js
now.setHours(0, 0, 0, 0);
start.setHours(0, 0, 0, 0);
end.setHours(0, 0, 0, 0);
```

Without this normalisation, a DST spring-forward (23-hour day) or fall-back (25-hour day) would cause `(end - start) / MS_PER_DAY` to return a fractional value, and `Math.round` would occasionally produce an off-by-one day count.

In `checkAndUpdateTripDates`, no Date objects are created, so `setHours` is not needed and must not be introduced.

| Function | Uses Date objects | `setHours(0,0,0,0)` required |
|---|---|---|
| `renderForecast` | Yes (day arithmetic) | **Yes** |
| `checkAndUpdateTripDates` | No (string comparison) | **No — prohibited** |

---

## Inclusive Day Count Formula

```js
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const totalDays  = Math.round((end - start) / MS_PER_DAY) + 1;  // +1 is required
```

The `+ 1` makes the count **inclusive** of both the start day and the end day. A trip that starts and ends on the same day lasts `1` day, not `0`. Dropping the `+ 1` would make every trip appear one day shorter and break the forecast pace calculations.

Similarly, `daysElapsed` is computed as:

```js
const daysElapsed = Math.round((now - start) / MS_PER_DAY) + 1;
```

On the first day of the trip (`now === start`), `daysElapsed` is `1`, not `0` — matching the human-readable "Day 1 of N" display.

---

## Three Forecast Display States

`renderForecast` shows one of three states based on `daysElapsed` vs `totalDays`.

### State 1 — Trip hasn't started yet (`daysElapsed < 1`)

```
icon:    📅
message: "trip starts on {startDate} — no forecast yet."
bar:     hidden
card:    "forecast-card" (no colour modifier)
```

### State 2 — Trip is in progress (`1 ≤ daysElapsed ≤ totalDays`)

Progress bar is shown if `trip.budget` is set.

| Condition | `icon` | `colorClass` | Message pattern |
|---|---|---|---|
| No budget | `✅` | `ok` | `"Day {N} of {T} — on pace to spend {projected} total"` |
| Budget set, projected ≤ 80 % | `✅` | `ok` | `"Day {N} of {T} — ✅ under budget — projected {projected} vs {budget} budget"` |
| Budget set, 80 % ≤ projected < 100 % | `🟡` | `warn` | `"Day {N} of {T} — projected {projected} vs {budget} budget"` |
| Budget set, projected > 100 % | `⚠️` | `over` | `"Day {N} of {T} — ⚠️ over budget pace — projected {projected} vs {budget} budget"` |

Per-person amount is appended when `memberCount > 0`: `" ({perPerson}/person)"`.

### State 3 — Trip has ended (`daysElapsed > totalDays`)

```
icon:    🏁
message: "trip ended — final total: {total}[ ({perPerson}/person)]."
bar:     shown if trip.budget is set, hidden otherwise
card:    "forecast-card forecast-{ok|warn|over}" based on total vs budget
```

---

## Guard Clauses in `renderForecast`

`renderForecast` hides the forecast section and returns early when:

1. Either `trip.startDate` or `trip.endDate` is falsy.
2. Either parsed Date is not a finite number (invalid date string).
3. `totalDays < 1` (reversed or same-instant dates after arithmetic).

Never remove these guards — they protect against invalid data stored in `trips.json`.
