# Smart Split Suggestions

**Type:** feature
**Priority:** low

## Description
Instead of always defaulting to an equal split among all members, suggest contextual splits. For example, a hotel expense for 2 people shouldn't auto-split across all 5 members. Use simple heuristics based on expense amount and description.

## Current Behavior
- New expenses default to splitting between all participants
- User must manually uncheck members who shouldn't be included

## Desired Behavior
- The expense form still defaults to all members selected
- A small hint appears below the split checkboxes with a suggestion when applicable:
  - High-value expenses (e.g. hotel): "This seems like accommodation — split between specific people?"
  - Low-value expenses: No suggestion (likely group expense)
- Clicking the suggestion pre-selects a smaller group (or opens a "smart split" mode)
- Suggestions are keyword-based, not AI-powered

## Acceptance Criteria
- [ ] A hint area below the split checkboxes in the expense form
- [ ] Keyword matching on description triggers suggestions (e.g. "hotel" → "accommodation for specific people?")
- [ ] Clicking the suggestion does NOT change selections automatically — it just highlights the hint
- [ ] No suggestion shown for generic descriptions or when all members are appropriate
- [ ] Does not interfere with normal expense creation flow

## Implementation Hints
- **Frontend** (`public/js/app.js`): In `expenseModalHTML()` or `attachExpenseFormHandlers()`, add a listener on the description input. On blur or after typing, check keywords and show a small `.split-hint` element.
- **Styling**: Subtle hint text below checkboxes, dismissible.
- **Keywords**: Reuse category keywords from issue 003 if available. Otherwise, simple map: `hotel|airbnb|accommodation` → "accommodation", `taxi|uber` → "transport for specific people?"
- Keep it non-intrusive — just a helpful nudge, not a requirement.

## Testing
- Manual: Type "hotel" in description, verify hint appears
- Verify hint does not appear for "dinner"
- Verify expense creation works normally with or without hint
