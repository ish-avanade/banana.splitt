# banana/splitt

A cost-splitting app for shared trips. Track participants, expenses, and calculate who owes whom with optimised settlements.

## Prerequisites

- [Node.js](https://nodejs.org/) (v22 or later recommended)
- [Docker](https://www.docker.com/) (optional, for Dev Container)

## Getting Started

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

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATA_FILE_OVERRIDE` | `data/trips.json` | Path to the JSON data file |

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
