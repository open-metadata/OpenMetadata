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
- **Never authenticate by driving the sign-in form; prefer a role page fixture.**
  `openmetadata-playwright/no-form-sign-in` enforces the first half at **error**. The second half is
  a recommendation it cannot check — `new UserClass()` + `signIn()` passes the rule — so reach for a
  fixture because it owns the account lifecycle, not because lint made you.

  `support/fixtures/userPages.ts` owns every signed-in page (`adminPage`, `dataConsumerPage`, `dataStewardPage`, `ownerPage`,
  `editDescriptionPage`, `editTagsPage`, `editGlossaryTermPage`, `viewOnlyPage`);
  `e2e/fixtures/pages.ts` re-exports them and aliases `page` to `adminPage`. When the test needs its
  own account, `support/fixtures/isolatedUser.ts` has `isolatedUserPage` (one per worker) and
  `freshUserPage` (one per test) — both create *and delete* the account, so there is no
  `beforeAll`/`afterAll` bookkeeping to get wrong. Never call `UserClass.login()`: it drives the
  sign-in form (nine UI interactions). `UserClass.signIn()` establishes the same session with one
  POST and runs the identical post-sign-in steps. Creating a user as *test data* is fine; signing
  one in through the form is what the rule flags.

  No suppressions and **no disables**. The two cases that genuinely need the form call
  `signInThroughForm(page, user)` from `utils/formSignIn.ts` — the one module on
  the rule's exemption list — so the intent reads at the call site instead of as a suppression:
  either the form is the subject (`Auth/Login.spec.ts`), or the *route the app lands on* after
  sign-in is the assertion, which `signInViaApi` would mask because it finishes on `/my-data`
  (`Features/AppMode/**` — `AppModeAiPersonaLandsAtRoot` records every navigation and asserts
  `/my-data` is never among them, so `signIn()` would fail it by construction). "This test needs a
  real session" is not a reason: `signIn()` posts to the same `/api/v1/auth/login`, so every
  server-side effect of signing in is identical.
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
- No `waitForTimeout`, `networkidle`, `force: true`, `waitForSelector`, or element handles. A click a
  toast can cover goes through `clickIgnoringToasts()` (`playwright/utils/common.ts`) — `force` only
  silences the hit-target check, and waiting for the toast stack to empty races every other worker.
- Disabling a rule requires a justification: `-- <why>` appended to the directive. A directive with
  **no rule list** is never allowed, justified or not — it silences all 18 rules and CI rejects it.

Existing violations are recorded in `eslint-suppressions.json`. That file may shrink, never grow.
