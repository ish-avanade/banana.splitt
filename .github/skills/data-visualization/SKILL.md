---
name: data-visualization
description: "Conventions and patterns for rendering charts and data visualizations in banana/splitt. Load this skill when implementing canvas-based charts, graphs, legends, or any visual data representation."
---

# Data Visualization on Canvas — Skill

> Conventions and patterns for rendering charts and data visualizations in banana/splitt.
> Load this skill whenever implementing canvas-based charts, graphs, legends, or any visual data representation.

## Canvas Setup Pattern

Always use device-pixel-ratio scaling for crisp rendering on Retina/HiDPI displays:

```js
const ctx = canvas.getContext('2d');
const dpr = window.devicePixelRatio || 1;
canvas.width = size * dpr;
canvas.height = size * dpr;
canvas.style.width = size + 'px';
canvas.style.height = size + 'px';
ctx.scale(dpr, dpr);
```

- Default canvas size: **260×260** for donut/pie charts
- All coordinate math uses the **logical** size (pre-DPR), never the physical pixel size
- Always clear or fully repaint — never partially redraw

## Color Palette

Use the shared `PIE_COLORS` array (defined in `app.js`):

```js
const PIE_COLORS = [
  '#FBBF24', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6',
  '#F97316', '#EC4899', '#14B8A6', '#6366F1', '#F59E0B',
  '#06B6D4', '#84CC16', '#E11D48', '#A855F7', '#22D3EE',
];
```

- Cycle with `PIE_COLORS[i % PIE_COLORS.length]`
- Slices/bars may override via a `color` property on the data object (used by category charts)
- For data-driven colors (e.g. positive/negative), use semantic CSS variables: `var(--color-positive)` green, `var(--color-negative)` red
- White separators between slices/bars: `ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;`

## Chart Style — Donut (Default)

The default chart type is a **donut** (arc with inner cutout), not a solid pie:

- Outer radius: **110**
- Inner radius: **60**
- Start angle: **-Math.PI / 2** (12 o'clock)
- Center label: two lines — a lighter label ("Total") and a bold formatted amount
- Always draw arcs clockwise for consistency

## Typography on Canvas

Use the system font stack — never custom web fonts on canvas:

```js
ctx.font = '700 14px -apple-system, BlinkMacSystemFont, sans-serif';  // labels
ctx.font = '800 16px -apple-system, BlinkMacSystemFont, sans-serif';  // emphasis
```

- Text color: `#111827` (matches `--text-primary` in CSS)
- Muted text: `#6B7280` (matches `--text-muted`)
- Always set `ctx.textAlign` and `ctx.textBaseline` before drawing text
- Use `fmt(amount, currency)` for all monetary values on canvas — never raw numbers

## Legend Pattern

Legends are rendered as **DOM elements** (not canvas), placed beside or below the chart:

```js
function renderChartLegend(container, slices, total, currency) {
  container.innerHTML = '';
  slices.forEach((slice, i) => {
    const pct = ((slice.amount / total) * 100).toFixed(1);
    const color = slice.color || PIE_COLORS[i % PIE_COLORS.length];
    // ... create .legend-item with .legend-dot, .legend-name, .legend-value, .legend-pct
  });
}
```

- Legend items use `escHtml()` for all user-provided text (participant names, descriptions)
- Each item shows: color dot, name, formatted amount, percentage
- Container class: `.chart-legend`; item class: `.legend-item`

## Bar Chart Conventions (for new charts)

When adding bar charts (e.g. spending over time), follow these rules:

- Use the same DPR canvas setup pattern above
- Bars should have **rounded top corners** (4px radius) — use `ctx.roundRect()` or manual arc
- Bar width: calculated dynamically based on data points, with **4px gap** between bars
- Vertical axis: draw light gridlines (`#E5E7EB`, 1px) — no heavy borders
- Axis labels: use muted text color `#6B7280`, 11px font
- Hover/tooltip: not needed for MVP — use legend for details
- Animate on first render: optional, via `requestAnimationFrame` with eased progress (0→1 over ~400ms)

## Data Preparation

- Sort slices/bars by **amount descending** (largest first) unless temporal (dates → chronological)
- Filter out zero-amount entries before rendering
- Always compute `total` from the filtered data, not from raw input
- For date-based charts, group by ISO date string (`YYYY-MM-DD`) and sort chronologically

## Layout in HTML

Charts go inside the `.chart-section` container in the balances tab:

```html
<div class="chart-section" id="chart-section">
  <div class="chart-section-header">
    <h2 class="section-title">Title</h2>
    <div class="chart-toggles">
      <button class="chart-toggle active" id="toggle-a">View A</button>
      <button class="chart-toggle" id="toggle-b">View B</button>
    </div>
  </div>
  <div class="chart-container">
    <canvas id="my-chart" width="260" height="260"></canvas>
    <div class="chart-legend" id="my-legend"></div>
  </div>
</div>
```

- Use toggle buttons for switching between chart views (payer vs category, etc.)
- Active toggle gets class `.active`
- Chart + legend sit inside `.chart-container` (flex row, wraps on mobile)

## Security

- **Never** put user content into canvas text without sanitization — although canvas `fillText()` doesn't execute HTML, always use trimmed/validated strings
- **Always** use `escHtml()` when building legend HTML from user data (names, descriptions)
- Color values from data objects should match `/^#[0-9a-fA-F]{3,8}$/` — don't inject arbitrary strings into style attributes

## PNG Export (if needed)

```js
function exportCanvasPng(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
```

- Use descriptive filenames: `banana-splitt-{tripName}-{chartType}.png`
- Sanitize trip name for filename (remove special chars)
