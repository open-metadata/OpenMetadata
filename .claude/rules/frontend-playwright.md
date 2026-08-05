---
description: Playwright E2E test constraints (lint-playwright)
paths: "openmetadata-ui/src/main/resources/ui/playwright/**"
---

# Playwright E2E constraints

Applies to `openmetadata-ui/src/main/resources/ui/playwright/**`.

**The gate is one command. Run it before you finish:**

```bash
yarn lint:playwright:suppressions
```

Every guardrail is enforced by that command at `error` severity — there are no advisory rules. The
full catalogue with per-rule descriptions is generated into
`playwright/PLAYWRIGHT_DEVELOPER_HANDBOOK.md`; do not hand-edit that table.

Highest-value constraints, all machine-enforced:

- No positional locators (`.first()`, `.last()`, `.nth()`) — narrow the locator, or use
  `getRowByName()` from `playwright/utils/scopedLocators.ts`.
- Register `waitForResponse` **before** the triggering action, or use `clickAndWaitFor()` from
  `playwright/utils/waitHelpers.ts`.
- Every test needs at least one `expect()`.
- `test.slow()` only inside the one test that needs it, never at file or describe scope.
- No `waitForTimeout`, `networkidle`, `force: true`, `waitForSelector`, or element handles.
- Disabling a rule requires a justification: `-- <why>` appended to the directive.

Existing violations are recorded in `eslint-suppressions.json`. That file may shrink, never grow.
