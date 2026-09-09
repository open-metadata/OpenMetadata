---
description: Playwright E2E test constraints (lint-playwright)
paths: "openmetadata-ui/src/main/resources/ui/playwright/**"
---

# Playwright E2E constraints

Applies to `openmetadata-ui/src/main/resources/ui/playwright/**`.

**Run this before you finish:**

```bash
yarn lint:playwright               # what CI runs — read-only
yarn lint:playwright:suppressions  # only after fixing violations; rewrites the baseline
```

The second is not a stronger check — it is the same lint plus `--prune-suppressions`. It *passes*
on the stale-entry case the first one fails on, and it rewrites a tracked file, so reach for it only
after you have fixed something, then commit the pruned `eslint-suppressions.json`.

Every `playwright/*` and `om-playwright/*` guardrail runs at `error`; repo-wide
`openmetadata-playwright/*` rules set their own severity and may be `warn`. The
full catalogue with per-rule descriptions is generated into
`playwright/PLAYWRIGHT_DEVELOPER_HANDBOOK.md`; do not hand-edit that table.

Highest-value constraints, all machine-enforced:

- No positional locators (`.first()`, `.last()`, `.nth()`) — narrow the locator, or use
  `getRowByName()` from `playwright/utils/scopedLocators.ts`.
- Never `await page.waitForResponse(...)` inline — hoist the listener above the action that
  triggers it, or use `clickAndWaitFor()` from `playwright/utils/waitHelpers.ts`. The rule bans the
  inline shape; it does not verify ordering, so an aliased call slips past it.
- A test that only interacts with the page and provably asserts nothing is flagged. The rule
  under-reports by design — any call it cannot see inside (a helper, a page object) exempts the
  test — so it is a backstop, not a guarantee that every test asserts.
- `test.slow()` only inside the one test that needs it, never at file or describe scope.
- **No UI input actions in setup hooks.** `page.click`, `page.fill`, `page.press`, `page.selectOption`,
  etc. inside `test.beforeAll`/`beforeEach`/`afterAll`/`afterEach` fail lint
  (`om-playwright/no-ui-in-test-setup`). Push setup state via `apiContext.<Entity>.create()` or a REST
  helper — the canonical pattern in this codebase already. `page.goto` in setup is *not* banned; only
  the input-action subset is. Rationale: every UI click in setup adds ~30 API calls to the SUT (PR
  #32594); the SUT-stress this compounds into is what surfaces as "flakiness".
- **`page.reload()` requires a justification comment.** A bare `await page.reload();` fails lint
  (`om-playwright/no-page-reload-without-justification`). If the reload is intentional (persistence
  test, service-worker upgrade, SSO return flow), add `// TEST_KEEP_RELOAD: <reason>` on the line
  above or on the same line. Rationale: every reload boots the SPA again — measured
  `appBootsPerUIScenario` is 2.3, convergence target is ≤1, and unjustified reloads are the dominant
  contributor. Prefer trusting the app to refetch on mutation (a stale UI after mutation is a product
  bug, not a test workaround).
- No `waitForTimeout`, `networkidle`, `force: true`, `waitForSelector`, or element handles.
- Disabling a rule requires a justification: `-- <why>` appended to the directive. A directive with
  **no rule list** is never allowed, justified or not — it silences all 18 rules and CI rejects it.

Existing violations are recorded in `eslint-suppressions.json`. That file may shrink, never grow.
