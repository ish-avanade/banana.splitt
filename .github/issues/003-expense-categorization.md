# Automatic Expense Categorization

**Type:** feature
**Priority:** medium

## Description
Auto-categorize expenses (food, transport, accommodation, activities, shopping, other) based on the description. Show a category breakdown in the dashboard pie chart alongside the existing payer breakdown.

## Current Behavior
- Expenses have a description but no category
- The pie chart only shows spending by payer

## Desired Behavior
- Each expense is automatically assigned a category based on keywords in its description
- Categories: 🍽️ Food & Drink, 🚗 Transport, 🏨 Accommodation, 🎯 Activities, 🛍️ Shopping, 📦 Other
- Users can override the auto-category when adding/editing an expense
- The dashboard shows a toggle or second chart for "by category" vs "by payer"
- Category icons appear on expense list items

## Acceptance Criteria
- [ ] Expense object gains an optional `category` field
- [ ] A keyword-based categorizer assigns categories automatically (no AI needed)
- [ ] The expense form includes a category dropdown, pre-filled by the auto-categorizer
- [ ] Expense list items show the category icon instead of the generic 💸
- [ ] Dashboard has two chart views: "By Payer" and "By Category", toggled by buttons
- [ ] Category chart uses distinct colors and shows category names in the legend
- [ ] Existing expenses without a category are categorized on-the-fly when displayed

## Implementation Hints
- **Categorizer**: Simple keyword map. e.g. `{ "Food & Drink": ["dinner", "lunch", "breakfast", "restaurant", "cafe", "coffee", "bar", "beer", "wine", "groceries", "food"], "Transport": ["taxi", "uber", "lyft", "bus", "train", "metro", "flight", "gas", "parking"], ... }`. Match case-insensitively against the description. Default to "Other".
- **Backend** (`server.js`): Accept optional `category` in expense create/update. No backend categorization — keep it frontend-only for simplicity.
- **Frontend** (`public/js/app.js`): Add `categorize(description)` function. Use it in `expenseModalHTML()` to pre-fill, and in `renderExpensesTab()` for the icon. Add chart toggle buttons and a `renderCategoryChart()` function following the same `drawPieChart` pattern.
- **Styling**: Category toggle buttons styled like the tabs. Category icons as emoji.

## Testing
- Test that the categorizer maps known keywords correctly
- Test that unknown descriptions map to "Other"
- Test that category is preserved through create/edit cycle
