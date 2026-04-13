# Duplicate & Anomaly Detection

**Type:** feature
**Priority:** low

## Description
Flag potential duplicate expenses and anomalous amounts to prevent accidental double-entries and typos.

## Current Behavior
- No validation or warnings when adding expenses similar to existing ones
- No warning for unusually large or small amounts

## Desired Behavior
- When adding a new expense, check against existing expenses for potential duplicates (same amount + similar description + same date)
- Show a warning banner in the expense form: "⚠️ This looks similar to 'Dinner' ($45.00) added on 2024-07-15"
- When the amount is significantly larger than the trip average (e.g. 5x), show a gentle warning: "This is much larger than your average expense ($23.50). Double-check the amount."
- Warnings are dismissible and don't block submission

## Acceptance Criteria
- [ ] Duplicate detection runs on blur of amount field in the expense form
- [ ] Duplicate is defined as: same amount ±5%, similar description (case-insensitive substring match), same date
- [ ] Warning appears as a yellow banner inside the form
- [ ] Anomaly detection: if amount > 5× average of existing expenses, show a warning
- [ ] Warnings don't appear when editing an existing expense (comparing against itself)
- [ ] Warnings are non-blocking — user can still submit

## Implementation Hints
- **Frontend** (`public/js/app.js`): In `attachExpenseFormHandlers()`, add blur/input listeners on amount and description fields. Compare against `trip.expenses`. Show/hide a `.form-warning` element.
- **Duplicate check**: `trip.expenses.some(e => Math.abs(e.amount - newAmount) / e.amount < 0.05 && e.date === newDate && e.description.toLowerCase().includes(desc.toLowerCase()))`
- **Anomaly check**: `const avg = trip.expenses.reduce((s,e) => s+e.amount, 0) / trip.expenses.length; if (amount > avg * 5) showWarning(...)`
- **Styling**: `.form-warning` with yellow background, warning icon, dismissible with ×.
- **Edge cases**: First expense (no average to compare), editing (exclude self from comparison).

## Testing
- Manual: Add an expense, then add another with same amount/date/description — verify warning
- Add an expense 10x larger than average — verify anomaly warning
- Verify warnings don't appear during edit of the same expense
