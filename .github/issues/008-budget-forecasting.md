# Budget Forecasting

**Type:** feature
**Priority:** low

## Description
Show a mid-trip spending forecast: based on current pace, estimate what the total will be by the trip's end. Helps groups stay on budget.

## Current Behavior
- Dashboard shows total spent and per-person average
- No projection or budget tracking

## Desired Behavior
- Trip gains optional `startDate`, `endDate`, and `budget` fields (set at creation or editable later)
- Dashboard shows a "Forecast" card when dates are set:
  - "Day 3 of 7 — On pace to spend $3,200 total ($640/person)"
  - If over budget: "⚠️ Over budget pace — projected $3,200 vs $2,500 budget"
  - If under: "✅ Under budget — projected $1,800 vs $2,500 budget"
- A simple progress bar shows budget utilization

## Acceptance Criteria
- [ ] Trip creation form has optional start date, end date, and budget fields
- [ ] Trip edit capability (or settings modal) to set these after creation
- [ ] Backend stores and returns `startDate`, `endDate`, `budget` on trip object
- [ ] Dashboard "Forecast" card visible when dates are set
- [ ] Forecast calculates: `(totalSoFar / daysElapsed) * totalDays`
- [ ] Progress bar shows `totalSoFar / budget` percentage
- [ ] Color coding: green (under budget), yellow (80-100%), red (over budget)
- [ ] Graceful when no dates/budget set — card simply hidden

## Implementation Hints
- **Backend** (`server.js`): Add optional `startDate`, `endDate`, `budget` to trip creation and the trip object. Add a `PUT /api/trips/:id` endpoint if it doesn't exist.
- **Frontend** (`public/js/app.js`): In `renderDashboard()`, add forecast card. Calculate days elapsed and project.
- **Frontend** (`public/index.html`): Add forecast card to the dashboard grid in `tpl-trip-detail` template. Also add date/budget fields to new trip form.
- **Styling**: Progress bar with gradient colors. Forecast card in the dashboard grid.

## Testing
- Create a trip with dates and budget, add expenses, verify forecast math
- Test edge cases: trip not started yet, trip already ended, no budget set
- API test: create trip with dates/budget, verify they're returned
