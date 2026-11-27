# The local Playwright planner runs specs that pull in a whole test project in a separate --no-deps pass

- **Status:** Accepted
- **Revisions:** v1 2026-10-10 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `.github/scripts/test_plan_local_playwright.py` covers the split and the refusal; the
  coupling to `playwright.config.ts` is guarded by reviewer only.
- **Related:** open-metadata/OpenMetadata#35046, open-metadata/OpenMetadata#35047,
  `.github/scripts/plan_local_playwright.py`, `openmetadata-ui/src/main/resources/ui/playwright.config.ts`

## Context

`make playwright_affected` used to pass every selected spec to one `npx playwright test` command.
`IntakeForm` and `SystemCertificationTags` belong to projects that depend on the whole `chromium`
project, and Playwright always runs a dependency project in full. One of those specs in a plan
turned a local run into the entire suite: #35009 planned 39 specs and ran 4,386 tests. CI does not
hit this because it gives those projects their own shard, where they depend only on `setup`.

## Decision

- Before running, the planner resolves the plan with `playwright test --list --reporter=json`. Any
  top-level spec file in that listing that is outside the plan and is not a setup or teardown
  fixture counts as an expansion.
- Fixture files are recognised by `FIXTURE_FILE`, which must stay the same regex as
  `FIXTURE_TEST_MATCH` in `playwright.config.ts`.
- Only a project whose `testMatch` does not contain `*.@(spec|test)` (a *dedicated* project) may
  depend on another test project. When the run expands, the planner lists only the specs in
  dedicated projects one by one. Any spec that expands on its own runs in a second pass with
  `--no-deps`, after the main pass has signed in and run the entity-data setup and teardown. That
  matches CI's sharding.
- If the main pass still expands after isolation, the planner refuses to run.
- The per-spec listings run on `LIST_WORKERS = 6` threads. Each listing starts Node and loads the
  config, which takes about 6 seconds. A plan has only a handful of dedicated-project specs, so six
  keeps the check close to the time of one listing without starting a Node process per spec at once.

## Consequences

- A local run executes the plan, or it fails loudly. It never quietly runs the full suite.
- Every run now needs the Node toolchain, `--json` included, because the listing calls `npx`.
- Adding a test-project dependency to a catch-all project (one matching `*.@(spec|test)`) makes the
  planner refuse to run plans containing its specs. Changing `FIXTURE_TEST_MATCH` without
  `FIXTURE_FILE` makes it treat fixtures as expansions. Either change needs this record and the
  planner updated in step.
- An isolated spec that needs data from its dependency project, not just sign-in, would fail
  locally under `--no-deps`. Today none does. If one did, the planner would have to run that
  dependency for it, which is a new decision.
