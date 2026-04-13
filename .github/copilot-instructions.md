# banana/splitt — Project Context

## Overview
Cost-splitting web app for group trips. Express 5 backend, vanilla JS frontend, JSON file storage.

## Stack
- **Backend**: Express 5, Node.js (`server.js`), JSON persistence (`data/trips.json`)
- **Frontend**: Vanilla HTML/CSS/JS in `public/` — no build tools, no frameworks
- **Tests**: Node built-in test runner (`node --test tests/api.test.js`)

## Commands
- `npm run dev` — start with `--watch` (auto-restart)
- `npm start` — production start
- `npm test` — run API tests

## Architecture
- API routes: `/api/trips`, `/api/trips/:id`, `/api/trips/:id/expenses`, `/api/trips/:id/balances`, `/api/trips/:id/participants`
- Frontend uses hash-based routing (`#trip/:id`)
- Templates via `<template>` elements cloned with `cloneTemplate()`
- Donut chart rendered on `<canvas>` (no chart library)

## Conventions
- Always use `escHtml()` / `escAttr()` for user content in innerHTML
- Currency formatting via `fmt(amount, currency)` using `Intl.NumberFormat`
- Avatar colors are deterministic from name via `avatarStyle()`
- Toast notifications via `toast(message, type)`
- Modals via `openModal(html)` / `closeModal()`

## Issue Workflow
Feature requests and bug reports are tracked as markdown files in `.github/issues/`.
Each file follows a structured template with title, type, description, acceptance criteria, and implementation hints.
Use `/file-issue` to create new issues. Use `@implement` to pick up and implement an issue.
