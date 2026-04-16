# banana/splitt 🍌

> Split trip expenses with your group — multi-currency, AI-powered, no sign-up required.

> Run `npm run dev` and open http://localhost:3000 to see the app in action.

## Features

- **Trip management** — create, edit, and delete trips with a name, description, and base currency
- **Participant management** — add and remove members per trip; members auto-created from AI-parsed expenses
- **Expense tracking** — record expenses with date, payer, amount, and flexible equal or custom splits
- **Multi-currency support** — enter expenses in any currency; automatic conversion to the trip base currency via the [Frankfurter API](https://api.frankfurter.dev/v1/)
- **AI-powered expense entry** — type a natural language message (e.g. _"Alice paid $50 for dinner"_) and let the AI parse it into a structured expense
- **Auto-member creation** — AI parsing detects new participant names and adds them to the trip automatically
- **Expense categorisation** — choose a category (food, transport, accommodation, etc.) with matching icons for each expense
- **Dashboard summary cards** — total spent, number of expenses, member count, and per-person share at a glance
- **Interactive donut chart** — visualise spending broken down by payer or by category, toggled with a single click
- **Budget forecasting** — set a trip budget and see a progress bar with projected overspend when trip dates are configured
- **Balance calculation** — see who owes whom with optimised, minimal settlement suggestions
- **Share / export** — copy or share the balance summary via clipboard or the native Web Share API
- **AI-generated trip summary** — generate a human-readable narrative summary of the trip's spending

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v22 or later recommended)
- [Docker](https://www.docker.com/) (optional, for Dev Container)

### Option 1: Dev Container (recommended)

1. Install the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) VS Code extension
2. Open this repo in VS Code and choose **Reopen in Container** when prompted
3. Dependencies are installed automatically — run `npm start`

### Option 2: Local Setup

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The app will be available at **http://localhost:3000**.

### Development Mode

For auto-reloading on file changes:

```bash
npm run dev
```

### Running Tests

```bash
npm test
```

## User Guide

1. **Create a Trip** — On the home page click **+ New Trip**, enter a name, optional description, and select the base currency, then save.
2. **Add Members** — open the trip and go to the **Members** tab, then click **+ Add Member** and enter the person's name.
3. **Add Expenses** — click **+ Add Expense**, fill in the description, amount, payer, and split, then optionally choose a different currency for the expense.
4. **Use AI to Add Expenses** — type a natural language message in the AI chat bar (e.g. _"Alice paid $50 for dinner, split with everyone"_), review the parsed expense card, and click **Add**.
5. **View Balances** — switch to the **Balances** tab to see the dashboard summary, the spending donut chart, who owes what, and settlement suggestions.
6. **Share Summary** — click the share button on the Balances tab to copy or share the balance summary via the native share sheet.
7. **Set Trip Dates & Budget** — click ⚙️ **Settings** to set start/end dates and an optional budget; the Balances tab will then show a budget forecast progress bar.

## AI Features

banana/splitt supports two AI providers for natural language expense parsing. Configure one by copying `.env.example` to `.env` and filling in the relevant variables.

### Azure OpenAI (via Azure AI Foundry)

```env
AZURE_OPENAI_API_KEY=<your-key>
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4.1-deployment
# AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

### Direct OpenAI

```env
OPENAI_API_KEY=<your-key>
# OPENAI_MODEL=gpt-4o-mini
```

### What the AI can do

- Parse a natural language sentence into one or more structured expenses
- Detect amounts and currencies (e.g. "$50", "€45")
- Identify the payer and the participants in the split
- Auto-create new trip members that are mentioned but not yet added
- Default to an equal split across all current members when no split is specified

### Checking AI status

`GET /api/ai-enabled` returns `{ "enabled": true }` when AI features are available, either because an AI provider is configured or because mock AI responses are enabled via the `MOCK_AI_RESPONSE` environment variable (used for development/tests). It returns `{ "enabled": false }` otherwise. The frontend uses this endpoint to show or hide the AI chat bar.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/trips` | List all trips |
| POST | `/api/trips` | Create a trip |
| GET | `/api/trips/:id` | Get a single trip |
| PUT | `/api/trips/:id` | Update a trip |
| DELETE | `/api/trips/:id` | Delete a trip |
| POST | `/api/trips/:id/participants` | Add a participant |
| DELETE | `/api/trips/:id/participants/:pid` | Remove a participant |
| POST | `/api/trips/:id/expenses` | Add an expense |
| PUT | `/api/trips/:id/expenses/:eid` | Update an expense |
| DELETE | `/api/trips/:id/expenses/:eid` | Delete an expense |
| GET | `/api/trips/:id/balances` | Get balances & settlements |
| GET | `/api/ai-enabled` | Check whether AI features are configured |
| POST | `/api/trips/:id/parse-expense` | Parse natural language into expense(s) |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATA_FILE_OVERRIDE` | `data/trips.json` | Path to the JSON data file |
| `AZURE_OPENAI_API_KEY` | — | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | — | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT` | — | Azure OpenAI model deployment name |
| `AZURE_OPENAI_API_VERSION` | `2024-08-01-preview` | Azure OpenAI API version |
| `OPENAI_API_KEY` | — | Direct OpenAI API key (alternative to Azure) |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model name |

Copy `.env.example` to `.env` and fill in the variables you need. At minimum you need either the Azure OpenAI set or the direct OpenAI set for AI features to be available.

## Copilot Agents & Prompts

This project includes custom VS Code Copilot agents and prompts for an AI-assisted development workflow.

### Filing Issues

Use `/file-issue` in Copilot Chat to create a detailed, structured issue from a plain description.

```
/file-issue the pie chart doesn't render on mobile
/file-issue add receipt scanning --cloud
```

| Flag | Behavior |
|------|----------|
| `--local` (default) | Creates a local issue spec in `.github/issues/` for `@implement` |
| `--cloud` | Creates the local spec **and** a GitHub Issue assigned to Copilot's cloud agent |

### Implementing Issues

Use `@implement` in Copilot Chat to pick up and build an issue end-to-end.

```
@implement 001
@implement 003 --cloud
```

| Flag | Behavior |
|------|----------|
| `--local` (default) | Implements the issue in your VS Code workspace (edits files, runs tests) |
| `--cloud` | Pushes the issue to GitHub and assigns Copilot's cloud agent to handle it |

### Pushing Issues to GitHub

Use `/push-issues` to bulk-push local issue specs to GitHub Issues assigned to Copilot.

```
/push-issues all
/push-issues 001
```

### Current Issues

| # | Title | Priority |
|---|-------|----------|
| 001 | Historical Currency Conversion | High |
| 002 | Natural Language Expense Entry via AI Chat | High |
| 003 | Automatic Expense Categorization | Medium |
| 004 | AI-Generated Trip Summary | Medium |
| 005 | Smart Split Suggestions | Low |
| 006 | Payment Reminder Messages | Medium |
| 007 | Duplicate & Anomaly Detection | Low |
| 008 | Budget Forecasting | Low |
| 009 | Fix Currency API URL | High |
| 010 | Smarter AI Expense Parsing | High |
| 011 | AI "Add" Drops Currency | High |
