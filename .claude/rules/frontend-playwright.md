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
- **Sign in with a role page fixture, not a bespoke user.** `support/fixtures/userPages.ts` owns
  every signed-in page (`adminPage`, `dataConsumerPage`, `dataStewardPage`, `ownerPage`,
  `editDescriptionPage`, `editTagsPage`, `editGlossaryTermPage`, `viewOnlyPage`);
  `e2e/fixtures/pages.ts` re-exports them and aliases `page` to `adminPage`. When the test needs its
  own account, `support/fixtures/isolatedUser.ts` has `isolatedUserPage` (one per worker) and
  `freshUserPage` (one per test) — both create *and delete* the account, so there is no
  `beforeAll`/`afterAll` bookkeeping to get wrong. Never call `UserClass.login()`: it drives the
  sign-in form (nine UI interactions). `UserClass.signIn()` establishes the same session with one
  POST and runs the identical post-sign-in steps; only a spec testing the form itself should drive
  `login()`. Creating a user as *test data* is unrelated and unaffected.
- **`beforeAll` is not a per-worker hook.** Under `fullyParallel` it runs once per *group* of the
  file's tests dispatched to a worker, with `afterAll` in between — so it can run twice in one
  worker. Rebuild describe-scope state at the top of the hook; never `.push()` into it.
- Never `await page.waitForResponse(...)` inline — hoist the listener above the action that
  triggers it, or use `clickAndWaitFor()` from `playwright/utils/waitHelpers.ts`. The rule bans the
  inline shape; it does not verify ordering, so an aliased call slips past it.
- A test that only interacts with the page and provably asserts nothing is flagged. The rule
  under-reports by design — any call it cannot see inside (a helper, a page object) exempts the
  test — so it is a backstop, not a guarantee that every test asserts.
- `test.slow()` only inside the one test that needs it, never at file or describe scope.
- No `waitForTimeout`, `networkidle`, `force: true`, `waitForSelector`, or element handles.
- Disabling a rule requires a justification: `-- <why>` appended to the directive. A directive with
  **no rule list** is never allowed, justified or not — it silences all 18 rules and CI rejects it.

Existing violations are recorded in `eslint-suppressions.json`. That file may shrink, never grow.
