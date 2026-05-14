# Simplify Budget Forecast Display

**Type:** improvement
**Priority:** medium

## Description
The Budget Forecast card currently shows verbose contextual info like "Day X of Y", pace projections, and per-person breakdowns. The user wants a cleaner, simpler display that focuses on **total spend vs budget** with clear colour-coded status — green for under budget, orange-red for over budget. The card should still look polished and visually appealing.

## Current Behavior
- In-progress trips show: "Day 48 of 61 — ✅ under budget — projected £2,684.99 vs £6,000.00 budget"
- Ended trips show: "🏁 trip ended — final total: €428.64 (€142.88/person)."
- Three colour states: `ok` (green), `warn` (yellow), `over` (red)
- Icons vary: ✅, 🟡, ⚠️, 📅, 🏁
- Progress bar shows spend against budget with percentage label

## Desired Behavior
- **Remove** "Day X of Y" day counter from the message text
- **Remove** projected spending calculations and per-person breakdowns from the forecast text
- **Simplify to two colour states**: green (under/at budget) and orange-red (over budget) — drop the yellow "warn" state
- **Simplified text messages**:
  - No budget set: show total spend only (e.g. "Total: €428.64")
  - Under/at budget: "€2,112.78 of €6,000.00 budget" (green)
  - Over budget: "€7,200.00 of €6,000.00 budget — over budget!" (orange-red)
  - Trip not started: "Trip starts on YYYY-MM-DD"
  - Trip ended (no budget): "Trip ended — total: €428.64"
  - Trip ended (with budget): same spend-vs-budget format as in-progress
- **Progress bar**: keep current bar but use only green/orange-red fill colours
- **Icons**: simplify to ✅ (under budget), 🔴 (over budget), 📅 (not started), 🏁 (ended, no budget)
- The card should still look clean and polished with the left border colour accent

## Acceptance Criteria
- [ ] Day counter ("Day X of Y") is removed from all forecast messages
- [ ] Projected spending and per-person calculations are removed
- [ ] Only two colour states remain: green (ok) and orange-red (over) — no yellow/warn
- [ ] Progress bar fill uses green or orange-red only
- [ ] Card left border uses green or orange-red only
- [ ] Text shows simple "spent of budget" format when budget is set
- [ ] Forecast still displays correctly for: not-started, in-progress, and ended trips
- [ ] Forecast still hidden when no dates are set
- [ ] CSS `.forecast-warn` / `.fill-warn` classes are removed or repurposed
- [ ] Data-visualization skill (`data-visualization/SKILL.md`) is updated to document the simplified forecast colour scheme
- [ ] Trip-dates skill (`trip-dates/SKILL.md`) is updated if forecast display states documentation changes

## Implementation Hints
- Modify `renderForecast()` in `public/js/app.js` (line ~659).
- Simplify the in-progress branch: remove `projected` calculation, remove `Day X of Y`, remove per-person text. Just show spend vs budget with colour.
- Simplify the ended branch: remove per-person text. Show spend vs budget when budget is set.
- Replace the three-tier colour logic (`ok`/`warn`/`over`) with two tiers:
  - `ok` when `total <= budget` (green)
  - `over` when `total > budget` (orange-red)
- In CSS (`public/css/style.css` line ~589): remove or repurpose `.forecast-warn` and `.fill-warn`. Change `.forecast-over` / `.fill-over` to use an orange-red colour (e.g. `#EF6C00` or `var(--red)` depending on what looks best).
- Update `.github/skills/data-visualization/SKILL.md` to document the simplified two-state forecast colour scheme.
- Keep the existing `setHours(0,0,0,0)` normalisation and date guards — those are correct (see trip-dates skill).
- Keep the "not started" and "no dates" guards unchanged.

## Testing
- Manually: view a trip with budget set, under budget — card should be green with "X of Y budget" text.
- Manually: view a trip with budget set, over budget — card should be orange-red.
- Manually: view a trip with no budget — should show total spend only.
- Manually: view a trip that hasn't started — should show start date.
- Manually: view an ended trip — should show final total or spend vs budget.
- No backend changes, so no new `tests/api.test.js` cases required.
