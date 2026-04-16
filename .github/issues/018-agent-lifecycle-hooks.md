# Add Agent Lifecycle Hooks to @implement Agent

**Type:** feature
**Priority:** medium

## Description
The `@implement` agent currently lacks lifecycle hooks for automation around the implementation workflow. Hooks would allow the agent to validate issue format before starting, create git commits after successful implementation, update issue status, and create debug issues on failure. This makes the workflow more autonomous and self-documenting.

## Current Behavior
- The `@implement` agent in `.github/agents/implement.agent.md` lacks lifecycle hooks in its YAML frontmatter
- No automated validation that issues conform to the template before implementation starts
- No automatic git commits after successful implementation
- No skill-existence checking before implementation
- No debug issue creation on failure

## Desired Behavior
The agent frontmatter includes `hooks` section with the following lifecycle events:

### Before implementation starts (`onBefore`)
- **`validate_issue_format`** — Verify the issue file has required sections (Description, Current Behavior, Desired Behavior, Acceptance Criteria, Implementation Hints)
- **`check_skill_exists`** — If the issue references a skill file (e.g. `.github/skills/expense-validation/SKILL.md`), verify it exists; if not, alert the agent to create it first

### After successful implementation (`onSuccess`)
- **`commit_changes`** — Auto-commit all modified files with message format: `feat: issue NNN — <issue-title>` (extract issue number and title from the issue file)
- **`update_issue_status`** — Mark all acceptance criteria checkboxes as completed (`[ ]` → `[x]`) in the local issue file if all tests passed
- **`create_followup_if_needed`** — If the issue mentions "create a SKILL.md" in Implementation Hints, create a new GitHub issue for documenting the skill

### After failed implementation (`onFailure`)
- **`create_debug_issue`** — Create a new issue in `.github/issues/NNN-debug-<timestamp>.md` with type `bug`, title `Debug: issue NNN implementation failed`, body containing:
  - Original issue reference
  - Test output (last 50 lines of `npm test`)
  - Error messages from the attempt
  - Suggested next steps

## Acceptance Criteria
- [ ] `implement.agent.md` YAML frontmatter includes a `hooks` section
- [ ] `onBefore` hooks include `validate_issue_format` and `check_skill_exists`
- [ ] `onSuccess` hooks include `commit_changes`, `update_issue_status`, and `create_followup_if_needed`
- [ ] `onFailure` hooks include `create_debug_issue`
- [ ] Hook descriptions in frontmatter are clear and executable by an agent
- [ ] Each hook is defined with sufficient context for the agent to understand what to do
- [ ] The implementation does not break existing `@implement` functionality
- [ ] Hooks gracefully handle edge cases (missing skill, no tests, empty issue file)

## Implementation Hints

### File to modify
- `.github/agents/implement.agent.md` — Update YAML frontmatter with `hooks` section

### Hook implementation
Hooks are defined as a map in YAML frontmatter with the following structure:

```yaml
---
hooks:
  onBefore:
    - name: validate_issue_format
      description: "Ensure the issue file has all required sections before proceeding..."
      action: |
        Check that .github/issues/NNN-*.md contains:
        - A top-level # Title heading
        - **Type:** field with value (feature|bug|improvement)
        - **Priority:** field with value (high|medium|low)
        - ## Description section with content
        - ## Current Behavior section with content
        - ## Desired Behavior section with content
        - ## Acceptance Criteria section with checklist items (- [ ])
        - ## Implementation Hints section
        If any section is missing, halt and report: "Issue is missing sections: [list]"
  
  onSuccess:
    - name: commit_changes
      description: "Automatically commit changes with conventional commit message..."
      action: |
        1. Extract issue number NNN from the filename .github/issues/NNN-*.md
        2. Extract the issue title (first # Heading) from the issue file
        3. Run: git add -A
        4. Run: git commit -m "feat: issue NNN — <issue-title>"
        If git fails (no changes, not a repo), silently skip
  
  onFailure:
    - name: create_debug_issue
      description: "Create a debug issue documenting the failure for investigation..."
      action: |
        1. Capture the last 50 lines of test output
        2. Create .github/issues/NNN-debug-<timestamp>.md with type: bug
        3. Include original issue reference, error output, and next steps
---
```

### Edge cases
- **Missing skill**: If issue references a skill that doesn't exist, the agent should create the skill file structure first, then proceed
- **No git repo**: If `git commit` fails because it's not a repo, silently skip the commit hook
- **Empty test output**: If tests don't generate output, use error messages from stderr instead
- **Issue file malformed**: If the issue file is invalid YAML/markdown, `validate_issue_format` hook should catch it and halt

## Testing
- Manually verify hooks are defined in the YAML frontmatter of `.github/agents/implement.agent.md`
- Run `@implement 001` and verify:
  - Validation hook runs (or passes silently if not implemented programmatically)
  - After success, `git log --oneline` shows a commit with message `feat: issue 001 — <title>`
  - The issue file checkboxes are updated
- Run `@implement` on a malformed issue file (missing Acceptance Criteria section) and verify validation hook reports an error
- Verify the implement agent still functions normally with and without hooks wired

## Notes
This is a workflow automation feature that makes the agent more autonomous and reduces manual bookkeeping. Hooks are part of the agent customization framework and should be extensible (easy to add more hooks in future).
