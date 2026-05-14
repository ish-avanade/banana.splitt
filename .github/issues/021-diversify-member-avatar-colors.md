# Diversify Member Avatar Colors

**Type:** improvement
**Priority:** medium

## Description
Member avatars currently use a very small, fixed color palette and map colors using only the first character of the member name. This causes many collisions (for example, members with the same first initial often get the same avatar color), making the members and balances lists harder to scan.

## Current Behavior
Avatar color selection is defined in `avatarStyle(name)` in `public/js/app.js` and is based on `(name.charCodeAt(0) || 0) % PALETTE.length` with a 6-color palette. As a result, users frequently see repeated avatar colors across members.

## Desired Behavior
Avatars should keep deterministic color assignment per member name, but use a more diverse and evenly distributed set of colors so members are visually distinguishable at a glance in both Members and Balances tabs.

## Acceptance Criteria
- [ ] Increase avatar palette size to a clearly more diverse set (at least 12 distinct background/foreground pairs) while maintaining readable contrast for initials.
- [ ] Update color hashing so color selection uses the full normalized name string (not just the first character) to reduce collisions for same-initial names.
- [ ] Color output remains deterministic: the same member name always renders the same avatar colors across page reloads.
- [ ] Avatar rendering in both members list and balances list reflects the updated color strategy without layout regressions.
- [ ] Existing behavior for initials text generation remains unchanged.

## Implementation Hints
- Modify avatar color logic in `public/js/app.js` near `PALETTE` and `avatarStyle(name)`.
- Keep the API of `avatarStyle(name)` intact since it is used in both `renderMembersTab(...)` and `renderBalancesTab(...)`.
- Prefer a lightweight string hash over full-name characters (for example, cumulative char-code hashing) to spread names across the palette.
- Normalize input before hashing (trim and lowercase) and keep a safe fallback for empty names.
- Preserve accessibility by pairing each background with a matching text color that maintains legibility.

## Testing
- Manual:
  - Create/add multiple members with repeated first initials (e.g., "Ish", "Ibs", "Iris", "Ian") and verify colors are no longer clustered.
  - Confirm the same member name keeps the same avatar color after refresh.
  - Verify avatars in both Members and Balances tabs use the updated colors.
  - Check initials remain unchanged and readable on all palette entries.
- API tests:
  - No backend/API contract changes expected; no additions required in `tests/api.test.js`.
