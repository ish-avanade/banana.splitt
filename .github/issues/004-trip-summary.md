# AI-Generated Trip Summary

**Type:** feature
**Priority:** medium

## Description
Generate a shareable natural-language summary of the trip: total spent, biggest categories, who covered the most, key settlements. This extends the existing "Share Summary" button with a more readable, narrative format.

## Current Behavior
- The share button copies a structured text with raw balance numbers
- No narrative or context about the trip overall

## Desired Behavior
- A "Generate Summary" button on the balances tab produces a friendly narrative like:
  > "Over 5 days in Paris, the group spent €2,340 across 23 expenses. Dining was the biggest category at 45% (€1,053). Alice covered the most expenses. To settle up: Bob pays Alice €120, and Carol pays Alice €85."
- The summary can be shared/copied like the existing balance summary
- Works without AI — template-based generation using trip data

## Acceptance Criteria
- [ ] "Generate Summary" button appears on the balances tab (next to or replacing Share Summary)
- [ ] Summary is generated client-side from trip data (no API call needed)
- [ ] Summary includes: trip name, total spent, expense count, member count, top spender, biggest expense, settlement instructions
- [ ] If categories exist (issue 003), include top category
- [ ] Summary is formatted as readable prose, not a data dump
- [ ] Uses navigator.share on mobile, clipboard copy on desktop
- [ ] Toast confirms the action

## Implementation Hints
- **Frontend** (`public/js/app.js`): New function `generateTripSummary(trip, balances, settlements)` that composes a text string. Compute stats: total, per-person avg, top payer, biggest single expense, date range.
- **Template**: "🍌 {tripName} Summary\n\nThe group spent {total} across {count} expenses with {memberCount} people. {topPayer} covered the most ({topPayerAmount}). The biggest single expense was {biggestDesc} at {biggestAmount}.\n\n{settlements or 'All settled up!'}"
- Reuse the existing share logic from `shareBalancesSummary()`.

## Testing
- Manual: Create a trip with several expenses, generate summary, verify it reads well
- No backend changes needed
