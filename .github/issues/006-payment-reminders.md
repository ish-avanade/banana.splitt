# Payment Reminder Messages

**Type:** feature
**Priority:** medium

## Description
Generate friendly, ready-to-send payment reminder messages for each settlement. Users can copy a personalized message to send to someone who owes them money.

## Current Behavior
- Settlements section shows "Alice → pays $47.50 → Bob" but no easy way to send a reminder
- The share button copies the entire balance summary, not a targeted message for one person

## Desired Behavior
- Each settlement row has a "Remind" button (📩 or similar)
- Clicking it generates a friendly message and copies it to clipboard (or opens native share):
  > "Hey Alice! Just a heads up from our Paris trip 🍌 — you owe Bob $47.50. Here's the breakdown: [link or summary]. Thanks!"
- The message is pre-written but editable in a small modal before copying/sharing

## Acceptance Criteria
- [ ] Each settlement item has a "Remind" button
- [ ] Clicking shows a modal with the pre-generated message in a textarea
- [ ] User can edit the message before copying
- [ ] "Copy" button copies to clipboard and shows toast
- [ ] "Share" button uses navigator.share on supported devices
- [ ] Message includes trip name, amount, and payer/payee names
- [ ] Modal has a friendly, non-aggressive default tone

## Implementation Hints
- **Frontend** (`public/js/app.js`): In `renderBalancesTab()`, add a button to each settlement item. On click, call `showReminderModal(trip, settlement)` which opens a modal with a textarea pre-filled with the message.
- **Message template**: "Hey {fromName}! 👋 Quick reminder from our {tripName} trip — you owe {toName} {amount}. No rush, just keeping track with banana/splitt 🍌"
- **Modal**: Reuse `openModal()` pattern. Textarea + Copy button + optional Share button.
- **Styling**: Remind button fits inline with the settlement row. Use `.btn-ghost.btn-sm` style.

## Testing
- Manual: Create a trip with settlements, click Remind, verify message content
- Verify copy to clipboard works
- No backend changes needed
