# Add Favicon — Banana Emoji Browser Icon

**Type:** bug
**Priority:** low

## Description
The app has no favicon configured. The browser tab shows a generic globe/document icon instead of the banana 🍌 branding. A proper favicon should be added so the app is recognizable in browser tabs, bookmarks, and mobile home screens.

## Current Behavior
- No `<link rel="icon">` tag in `public/index.html`
- No favicon file exists in `public/`
- Browser shows default icon (globe or blank document depending on browser)

## Desired Behavior
- Browser tab shows a banana 🍌 emoji or banana-themed icon
- Works across all major browsers (Chrome, Firefox, Safari, Edge)
- Works when added to mobile home screen (PWA-style)

## Acceptance Criteria
- [ ] A favicon file exists in `public/` (SVG preferred for scalability, with PNG fallback)
- [ ] `<link rel="icon">` tag added to `<head>` in `public/index.html`
- [ ] Browser tab displays the banana icon instead of default globe
- [ ] Favicon renders clearly at small sizes (16×16, 32×32)
- [ ] Apple touch icon meta tag added for iOS home screen bookmarks

## Implementation Hints

### Approach: SVG Emoji Favicon (simplest, no external files needed)

The easiest approach that requires **no image files** — use an inline SVG favicon with the 🍌 emoji:

Add to `public/index.html` inside `<head>` (after the `<title>` tag, line ~6):

```html
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍌</text></svg>" />
```

This renders the banana emoji as the favicon directly — no image file needed, works in all modern browsers.

### Optional: Add PNG fallback + Apple Touch Icon

For broader compatibility and iOS home screen:

1. Create a `public/favicon.png` (32×32 PNG of a banana icon)
2. Create a `public/apple-touch-icon.png` (180×180 PNG)
3. Add to `<head>`:
```html
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍌</text></svg>" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
```

### Files to modify
- `public/index.html` — add `<link rel="icon">` in `<head>` section (line ~6–7)
- Optionally create `public/favicon.png` and `public/apple-touch-icon.png`

## Testing
- Open `http://localhost:3000` in browser — verify banana icon appears in the tab
- Open in a new incognito window (to avoid cached favicon)
- Test in Chrome and Firefox at minimum
- Bookmark the page — verify icon shows in bookmarks bar
