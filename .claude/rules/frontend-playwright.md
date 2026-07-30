---
description: Playwright E2E test constraints (lint-playwright)
paths: "openmetadata-ui/src/main/resources/ui/playwright/**"
---

# Playwright E2E constraints

Applies to `openmetadata-ui/src/main/resources/ui/playwright/**`. For authoring/validating tests use
the `playwright`, `writing-playwright-tests`, and `playwright-validation` skills — this file is the
hard constraints CI's `lint-playwright` enforces:

- **No `waitForLoadState('networkidle')`** — flaky; use web-first assertions.
- **No `page.pause()`** — remove before committing.
- **No `.only`** on tests — it blocks every other test in CI.
- Prefer `expect(locator).toBeVisible()` over manual `waitForSelector` checks.
- **Don't use `{ force: true }`** — fix the locator instead.
- Use locators, not element handles.

Run locally with `yarn playwright:run` (from `openmetadata-ui/src/main/resources/ui`).
