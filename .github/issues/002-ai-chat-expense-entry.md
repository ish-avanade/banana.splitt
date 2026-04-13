# Natural Language Expense Entry via AI Chat

**Type:** feature
**Priority:** high

## Description
Add an AI-powered chat input where users can describe expenses in natural language (e.g. "Alice paid €45 for dinner, split between everyone except Bob") and have it parsed into a structured expense. This makes expense entry faster and more natural, especially on mobile.

## Current Behavior
- Expenses are entered via a multi-field form (description, amount, date, payer, split checkboxes)
- No way to batch-enter expenses

## Desired Behavior
- A chat-style input appears on the trip detail page (or as a floating action)
- User types a natural description like:
  - "Alice paid 45 for dinner last night, split with everyone"
  - "Bob paid $30 for Uber and $85 for groceries"
  - "I paid 120 for the hotel, split between Alice and Carol"
- The app sends the message to an AI endpoint (OpenAI or similar) with trip context (member names, currency)
- The AI returns structured expense data
- The user sees a preview of the parsed expense(s) and can confirm or edit before saving
- Batch entries (multiple expenses in one message) are supported

## Acceptance Criteria
- [ ] New chat input UI on the trip detail page with a text input and send button
- [ ] Backend endpoint `POST /api/trips/:id/parse-expense` that accepts `{ message: string }` and returns parsed expense(s)
- [ ] Backend uses OpenAI API (or configurable provider) to parse the message with trip context
- [ ] Parsed result returned as array of expense objects: `[{ description, amount, paidBy, splitBetween, date }]`
- [ ] Frontend shows a confirmation card for each parsed expense with an "Add" and "Edit" button
- [ ] If parsing fails or is ambiguous, show the raw message and suggest manual entry
- [ ] API key is configured via `OPENAI_API_KEY` environment variable
- [ ] Graceful degradation: if no API key configured, hide the chat input entirely
- [ ] The chat input does NOT replace the existing form — both options coexist

## Implementation Hints
- **Backend** (`server.js`): New route `POST /api/trips/:id/parse-expense`. Load trip data (participant names, currency) and construct a system prompt that instructs the model to extract expense data. Use `fetch()` to call OpenAI chat completions API. Return parsed JSON.
- **System prompt** should include: participant names, trip currency, today's date, and instruct JSON output format.
- **Frontend** (`public/js/app.js`): Add a chat bar below the tabs or as a collapsible section. On submit, POST to the parse endpoint, then render confirmation cards. Each card has "Add" (calls existing expense creation) and "Edit" (opens the form pre-filled).
- **Frontend** (`public/index.html`): Add chat input to the `tpl-trip-detail` template.
- **Styling** (`public/css/style.css`): Chat input bar with a send button, confirmation cards with accept/edit actions.
- **Edge cases**: No API key (hide feature), API errors (toast + suggest manual), ambiguous payer names (fuzzy match to participants), missing fields (ask for clarification or use sensible defaults).

## Testing
- Test the parse endpoint with mock responses (don't call real AI in tests)
- Test that parsed expenses can be saved via existing expense creation endpoint
- Test graceful handling when `OPENAI_API_KEY` is not set
