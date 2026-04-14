# Update README with Latest Features, Screenshots & User Guide

**Type:** improvement
**Priority:** medium

## Description
The README is outdated — it reflects the initial MVP state. The app now has many new features (AI expense entry, currency conversion, expense categorization, budget forecasting, donut charts with payer/category toggle, trip settings, share/export, Azure OpenAI support). The README needs a full refresh with:
1. Updated feature list
2. Screenshots of key screens
3. Step-by-step user guide
4. Updated API table (new endpoints)
5. Updated environment variables (Azure OpenAI)
6. Updated issues table

## Current Behavior
- README describes basic CRUD functionality only
- No screenshots or visual guide
- API table missing `/api/ai-enabled` and `/api/trips/:id/parse-expense`
- Configuration table doesn't mention Azure OpenAI or dotenv
- Issues table only shows 001–008

## Desired Behavior

### Structure
The updated README should follow this structure:

```
# banana/splitt 🍌
> One-liner tagline

## Screenshots  ← NEW
## Features     ← NEW (feature list with descriptions)
## Getting Started (existing, minor updates)
## User Guide   ← NEW (step-by-step walkthrough)
## AI Features  ← NEW (how to configure & use AI expense entry)
## API Endpoints (updated)
## Configuration (updated with Azure OpenAI vars)
## Development (existing dev/test commands)
## Copilot Agents & Prompts (existing, kept as-is)
```

### Screenshots Section
Add a `docs/screenshots/` directory with placeholder image references. The implementer should add `<img>` tags with descriptive alt text pointing to these paths. Since actual screenshots must be captured manually, use a clear placeholder convention:

```markdown
![Home — trip list](docs/screenshots/home.png)
```

**Required screenshot slots:**
1. `home.png` — Trip list / home page with cards
2. `trip-expenses.png` — Trip detail with expense list
3. `trip-balances.png` — Balances tab with dashboard cards, donut chart, and settlements
4. `ai-chat.png` — AI chat bar with a parsed expense card
5. `currency-conversion.png` — Expense with foreign currency conversion annotation
6. `budget-forecast.png` — Budget forecast card (in-progress trip)

### Features Section
Bulleted list of major features with short descriptions:
- Trip management (create, edit, delete trips with custom currency)
- Participant management
- Expense tracking with date, payer, and flexible splits
- Multi-currency support with automatic conversion (Frankfurter API)
- AI-powered natural language expense entry (Azure OpenAI / OpenAI)
- Auto-member creation from AI parsing
- Expense categorization with icons
- Dashboard with summary cards (total, expenses, members, per person)
- Interactive donut chart (by payer / by category)
- Budget forecasting with progress bar (when trip dates are set)
- Balance calculation with optimized settlement suggestions
- Share/export balance summary (clipboard or native Share API)
- AI-generated trip summary

### User Guide Section
Step-by-step walkthrough:
1. **Create a Trip** — click "+ New Trip", enter name, optional description, select currency
2. **Add Members** — go to Members tab, click "+ Add Member"
3. **Add Expenses** — click "+ Add Expense", fill in description/amount/payer/split, optionally select a different currency
4. **Use AI to Add Expenses** — type a natural language message in the AI chat bar (e.g. "Alice paid $50 for dinner"), review the parsed card, click Add
5. **View Balances** — switch to Balances tab to see dashboard, spending chart, who owes what, and settlement suggestions
6. **Share Summary** — click the share button to copy or share the balance summary
7. **Set Trip Dates & Budget** — click ⚙️ Settings to set start/end dates and budget for forecasting

### AI Features Section
- Explain both Azure OpenAI and direct OpenAI configuration
- Reference `.env.example` for the variables
- Describe what the AI can do: parse expenses from natural language, detect currency, auto-create members, default even splits
- Mention the `/api/ai-enabled` endpoint for checking status

### Updated API Table
Add:
| GET | `/api/ai-enabled` | Check if AI features are configured |
| POST | `/api/trips/:id/parse-expense` | Parse natural language into expense(s) |

### Updated Configuration Table
Add all environment variables from `.env.example`:
| `AZURE_OPENAI_API_KEY` | — | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | — | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT` | — | Azure OpenAI model deployment name |
| `AZURE_OPENAI_API_VERSION` | `2024-08-01-preview` | Azure OpenAI API version |
| `OPENAI_API_KEY` | — | Direct OpenAI API key (alternative to Azure) |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model name |

### Updated Issues Table
Add issues 009–012.

## Acceptance Criteria
- [ ] README has a Screenshots section with image references for all 6 screenshot slots
- [ ] `docs/screenshots/` directory exists with a `.gitkeep` or placeholder README
- [ ] Features section lists all current features (at least 12 items)
- [ ] User Guide section has 7 step-by-step instructions
- [ ] AI Features section explains both Azure OpenAI and direct OpenAI setup
- [ ] API table includes `/api/ai-enabled` and `/api/trips/:id/parse-expense`
- [ ] Configuration table includes all Azure OpenAI and OpenAI environment variables
- [ ] Issues table updated with issues 009–012
- [ ] Existing sections (Getting Started, Dev Container, Tests, Copilot Agents) are preserved
- [ ] No broken markdown formatting

## Implementation Hints

### Files to modify
- `README.md` — full rewrite keeping existing structure where possible
- `docs/screenshots/.gitkeep` — create directory for screenshot placeholders

### Approach
1. Read the current `README.md` fully
2. Read `.env.example` for the complete env var list
3. Read `public/index.html` templates for the feature inventory
4. Read `server.js` API routes for the endpoint table
5. Rewrite README following the structure above
6. Create `docs/screenshots/` with a `.gitkeep`

### Key conventions
- Use `banana/splitt` (with forward slash) as the app name — never `banana.splitt`
- Keep the 🍌 emoji in the title
- Use GitHub-flavored markdown (tables, task lists, fenced code blocks)
- Screenshot images use standard markdown `![alt](path)` syntax
- Reference `npm run dev`, `npm test`, `npm start` for commands

## Testing
- Render README in GitHub preview — check all sections display correctly
- Verify all internal links (e.g. `.env.example` reference) are valid
- Verify markdown tables render properly
- Verify screenshot image paths are consistent with `docs/screenshots/` directory
