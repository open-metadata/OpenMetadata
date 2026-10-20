---
name: playwright-affected-tests
description: Select, run and record the Playwright specs an OpenMetadata branch impacts using the current checkout's generated map. Use before a UI PR, when asked which browser tests to run, or when running affected Playwright tests locally.
---

# Run affected Playwright tests locally

PR checks run every new or modified spec in its environment; the merge queue runs smoke and affected specs from its combined candidate diff. Shared test infrastructure or unknown production changes widen queue coverage to the full suite; nightly runs remain full. Run affected specs before review so failures surface while the author is working.

## Prepare the checkout

Work from the repository root on the branch being tested. Activate a Python 3.10+ venv before using the planner. The scripts use only the standard library. Node, Yarn and the UI dependencies are needed even for listing: the planner runs Playwright collection to check project dependencies.

Use `dev-setup` when the toolchain or dependencies are missing. Run against a local stack built from this checkout, following `docker/run_local_docker.sh` and the [local run documentation](../../.github/playwright/README.md). Check its health and version before treating browser results as evidence for the branch. Configure the UI's `.env` for this stack; use the existing credentials and fixture conventions. Do not stop another workspace's stack to make room.

## Select and run

```bash
make playwright_affected
make playwright_affected_run ARGS="--workers=2"
```

The planner includes committed, uncommitted and untracked changes against `origin/main`. Use `ARGS="--base <ref>"` when the change targets another base. It generates the impact map automatically from the current source and specs; do not regenerate or commit a snapshot.

Read the plan before running:

- **Impact-map gaps:** the local planner adds canaries while CI would select the full suite. Add missing semantic coverage to the handwritten map, or run the additional relevant specs and record that evidence.
- **Delegated specs:** authentication, RDF, visual and nightly suites run elsewhere. Run a directly affected delegated suite through its documented environment; an affected-test run does not validate it.
- **Dependency expansion:** the planner isolates specs that would otherwise pull in a whole project. Keep that protection; do not replace an empty selection with a bare Playwright command.

Generation or collection failures are failures to obtain a valid plan. Fix the cause before running; do not reuse an old generated map.

New and modified specs also run automatically in PR CI, including dedicated environments. Check `playwright-summary`: a skipped spec or a selection without execution cannot satisfy it. Source changes still need the affected local run above.

PR runs have no repository/environment secrets and no `safe to test` requirement. Tag existing credential-dependent tests or their smallest enclosing suite with `@requires-secrets`; they are excluded from PR execution and selected for the credential-enabled merge queue from the whole candidate diff. Mixed files still run their public cases on the PR. No conversion to mocks is required for this exception. Keep tagged tests registered during collection without credentials; perform account validation in fixtures/hooks. Do not add PR secret inheritance or bind the PR job to `test`.

Local affected runs default to `PLAYWRIGHT_SKIP_REQUIRES_SECRETS=true`, report credential-only files as deferred and run public cases in mixed files. Record the deferred coverage with the local results. An explicit local run with configured accounts may export `PLAYWRIGHT_SKIP_REQUIRES_SECRETS=false`. Check the queue result before merging: skipped credential cases cannot count as passed. Remove the tag when the private account dependency is removed.

## Record evidence

The run writes `playwright/output/local-pr-results.md` under the UI directory. Check the executed specs, failures, retry passes and skipped tests. A selection alone is not a passing test run.

Paste the results block into the PR description. When updating the PR is already authorized, use:

```bash
make playwright_affected_run ARGS="--workers=2 --update-pr"
```

Include the tested commit, whether uncommitted changes were present, the local stack used, and any affected suites not run. Re-run after changing code that invalidates the evidence. Use `playwright` when a bug reproducer or new E2E coverage is needed.
