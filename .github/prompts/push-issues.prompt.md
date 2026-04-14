---
description: "Push one or all local issue specs from .github/issues/ to GitHub Issues and assign to Copilot's cloud agent."
agent: "agent"
argument-hint: "Issue number (e.g. '001') or 'all' to push everything"
tools: [read, search, execute]
---

You push local issue specs to GitHub as real GitHub Issues assigned to Copilot.

## Process

1. **Find the issue(s)** — If the user says `all`, list all `.github/issues/*.md` files. Otherwise, find the one matching the number prefix.
2. **Check gh auth** — Run `gh auth status`. If not authenticated, tell the user to run `gh auth login` first and stop.
3. **For each issue file**:
   - Read the file to extract the title (first `# Heading` line)
   - Check if a GitHub Issue with that title already exists: `gh issue list --search "TITLE" --json number,title`
   - If it already exists, skip it and tell the user
   - If not, create it: `gh issue create --title "TITLE" --body-file .github/issues/NNN-slug.md --assignee "@copilot"`
   - Report the created issue number and URL
4. **Summary** — List all created/skipped issues.

## Rules

- Never create duplicate GitHub Issues
- Always assign to `@copilot`
- Do not modify the local issue files
- Report results clearly
