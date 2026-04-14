# Expense Analytics & Reporting — Spending Over Time Bar Chart + Category Comparison

**Type:** feature
**Priority:** medium

## Description
Add an analytics section to the balances tab with two new chart types that complement the existing donut chart:
1. **Spending Over Time** — a bar chart showing daily spending grouped by date
2. **Per-Member Comparison** — a horizontal bar chart comparing total spend per member

These charts reuse the project's established canvas rendering conventions documented in `.github/skills/data-visualization/SKILL.md`. The implementer **must** read that skill file before writing any canvas code.

## Current Behavior
The balances tab has:
- Dashboard summary cards (total, expenses, members, per person)
- Budget forecast section
- Donut chart with "By Payer" / "By Category" toggle
- Balances list and settlement suggestions

No temporal view of spending or per-member bar comparison exists.

## Desired Behavior
Below the existing donut chart section, add a new **"Analytics"** section with:

### 1. Spending Over Time (bar chart)
- X-axis: dates (from earliest to latest expense), one bar per day that has expenses
- Y-axis: total spend that day (in trip currency)
- Bars colored with `PIE_COLORS[0]` (amber/yellow brand color)
- Light gridlines on Y-axis
- Date labels on X-axis (formatted as `MM/DD` or `DD/MM` based on locale)
- If only 1 day of data, show a single centered bar
- Canvas size: 500×200 (logical pixels, DPR-scaled)

### 2. Per-Member Comparison (horizontal bar chart)
- One horizontal bar per participant, sorted by amount descending
- Bar length proportional to highest spender
- Each bar colored from `PIE_COLORS` by index
- Member name label to the left, amount label to the right
- Canvas size: 400×(participants × 40 + 40) (dynamic height)

### Chart Toggle
Add a toggle row with three buttons: **"By Payer"** | **"By Category"** | **"Over Time"** | **"By Member"**

The first two reuse the existing donut. The last two render the new bar charts on separate canvases below.

### PNG Export
Each chart canvas gets a small download button (📥) that exports the chart as a PNG file using `exportCanvasPng()` from the skill.

## Acceptance Criteria
- [ ] "Over Time" bar chart renders correctly with DPR scaling (crisp on Retina)
- [ ] "By Member" horizontal bar chart renders correctly
- [ ] Toggle buttons switch between all four views without errors
- [ ] Charts use `PIE_COLORS` palette and project font stack
- [ ] All legend/label text uses `escHtml()` for user content
- [ ] Monetary values on canvas use `fmt(amount, currency)`
- [ ] Charts handle edge cases: 0 expenses (hidden), 1 expense, 1 member
- [ ] PNG export works for each chart type
- [ ] Existing donut chart and toggle behavior is preserved
- [ ] Canvas conventions from `.github/skills/data-visualization/SKILL.md` are followed

## Implementation Hints

### Skill File
**Read `.github/skills/data-visualization/SKILL.md` first.** It documents the DPR scaling pattern, color palette, typography, bar chart conventions, and PNG export helper.

### Frontend (`public/js/app.js`)

**New functions to add:**

```js
function drawBarChart(canvas, bars, currency) { ... }
// bars = [{ label: '04/11', amount: 150 }, ...]
// Follow SKILL.md bar chart conventions: DPR scaling, rounded corners, gridlines

function drawHorizontalBarChart(canvas, bars, currency) { ... }
// bars = [{ name: 'Alice', amount: 300, color: '#FBBF24' }, ...]
// Dynamic canvas height based on bar count

function exportCanvasPng(canvas, filename) { ... }
// From SKILL.md — create download link with data URL
```

**Modify `renderDashboard(trip)`** (line ~525):
- Add two more toggle buttons to the existing `.chart-toggles` container
- Add a second canvas element for bar charts (or reuse the existing one with size changes)
- Wire up toggle click handlers for the new views

### HTML (`public/index.html`)

Add new canvas and toggle buttons inside the existing `chart-section`:
```html
<button class="chart-toggle" id="chart-toggle-time">Over Time</button>
<button class="chart-toggle" id="chart-toggle-member">By Member</button>
```

Add a second `<canvas>` for bar charts (different dimensions than the donut):
```html
<canvas id="bar-chart" width="500" height="200" class="hidden"></canvas>
```

### CSS (`public/css/style.css`)

Add styles for the bar chart canvas container — may need to override `.chart-container` flex direction or add a max-width for wider bar charts.

### Data Preparation

**Spending over time:**
```js
const byDate = {};
for (const e of trip.expenses) {
  byDate[e.date] = (byDate[e.date] || 0) + e.amount;
}
const bars = Object.entries(byDate)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([date, amount]) => ({ label: formatShortDate(date), amount }));
```

**Per-member comparison:**
```js
const bars = trip.participants.map((p, i) => ({
  name: p.name,
  amount: trip.expenses.filter(e => e.paidBy === p.id).reduce((s, e) => s + e.amount, 0),
  color: PIE_COLORS[i % PIE_COLORS.length],
})).sort((a, b) => b.amount - a.amount);
```

## Testing
- Create a trip with 3+ members and 5+ expenses across different dates
- Toggle between all four chart views — verify no rendering artifacts or JS errors
- Verify bar chart DPR scaling by zooming browser to 200%
- Verify PNG export downloads a readable image for each chart type
- Test with 0 expenses — chart section should be hidden
- Test with 1 expense on 1 date — single bar renders correctly
- Test with expenses all on same date — single bar with full amount
- Resize browser window — verify charts don't overflow container
