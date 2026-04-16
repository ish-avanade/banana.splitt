# Remove Fake Screenshots from README

**Type:** bug
**Priority:** high

## Description
The README contains a "Screenshots" section with 6 images in `docs/screenshots/` that are **fabricated** — they don't match the actual app UI. They show incorrect layouts, non-existent fields (country names, "My Trips" heading), wrong button labels, and a breadcrumb style the app doesn't have. These misleading images should be removed entirely.

Since we cannot programmatically capture real screenshots from within a dev container (no browser rendering available), the screenshots section should be removed and replaced with a note inviting users to run the app themselves.

## Current Behavior
- README has a "Screenshots" section at the top with 6 `![alt](docs/screenshots/*.png)` references
- `docs/screenshots/` contains 6 PNG files that are AI-generated fakes:
  - `home.png` — shows "My Trips" (app says "Your Trips"), country/duration fields that don't exist
  - `trip-expenses.png` — incorrect card layout and metadata
  - `trip-balances.png` — fabricated donut chart and dashboard that don't match real styling
  - `ai-chat.png` — shows "AI parsed 1 expense" text and "Add Expense"/"Dismiss" buttons that don't match real UI
  - `currency-conversion.png` — fabricated conversion display
  - `budget-forecast.png` — fabricated forecast card

## Desired Behavior
1. Remove the entire "Screenshots" section from README
2. Delete all fake PNG files from `docs/screenshots/`
3. Delete the `docs/screenshots/` directory (and `docs/` if empty)
4. Optionally add a one-line note in the README like: _"Run `npm run dev` and open http://localhost:3000 to see the app in action."_

## Acceptance Criteria
- [ ] "Screenshots" section removed from `README.md`
- [ ] All PNG files deleted from `docs/screenshots/`
- [ ] `docs/screenshots/` directory removed (including `.gitkeep`)
- [ ] `docs/` directory removed if empty after screenshot deletion
- [ ] No broken image references remain in README
- [ ] A brief "see it in action" note is added near the top of the README or in the Getting Started section

## Implementation Hints

### Files to modify
- `README.md` — remove the screenshots section (lines 7–13 approximately), add a brief note elsewhere
- Delete `docs/screenshots/` directory and all contents

### README changes
Remove this block:
```markdown
## Screenshots

![Home — trip list](docs/screenshots/home.png)
![Trip detail — expense list](docs/screenshots/trip-expenses.png)
![Balances tab — dashboard, donut chart & settlements](docs/screenshots/trip-balances.png)
![AI chat bar — parsed expense card](docs/screenshots/ai-chat.png)
![Expense with foreign currency conversion](docs/screenshots/currency-conversion.png)
![Budget forecast card](docs/screenshots/budget-forecast.png)
```

Optionally add after the tagline:
```markdown
> Run `npm run dev` and visit http://localhost:3000 to explore the app.
```

### File deletions
```bash
rm -rf docs/screenshots/
rmdir docs/ 2>/dev/null  # remove if empty
```

## Testing
- Verify README renders cleanly on GitHub with no broken image links
- Verify `docs/` directory no longer exists in the repo
- Search README for any remaining references to `docs/screenshots/` — should find none
