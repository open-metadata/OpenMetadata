---
name: writing-playwright-tests
description: Redirect only — this skill was merged into `playwright`. Invoke `playwright` instead for Playwright E2E authoring guidance and the required lint gate.
---

# Writing Playwright Tests Skill

## Pick the layer first

Page behaviour (paging, search, sort, URL state, forms, pickers, permission-driven controls,
empty/error states, visuals) goes in a Vitest browser test (`*.browser.test.tsx`), not here; see
`.claude/rules/frontend-browser-tests.md`. Write Playwright only for a journey across features against a
real server: the real search index, cross-page state, auth/SSO, async jobs, the production build.

This skill has been merged into the `playwright` skill — see
`skills/playwright/SKILL.md` (section "Writing Playwright Tests") for authoring guidance, and its
"Mandatory verification" section for the required lint gate.

This file is kept only so existing references to `writing-playwright-tests` still resolve.
