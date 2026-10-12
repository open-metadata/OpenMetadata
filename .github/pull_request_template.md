<!--
Thank you for your contribution!
Unless your change is trivial, please create an issue to discuss the change before creating a PR.
-->

### Describe your changes:

Fixes #<issue-number>
<!--
Linking an issue is REQUIRED. Replace <issue-number> with the GitHub issue number this PR addresses
(e.g., `Fixes #12345`). GitHub will auto-link it. If no issue exists, please open one first so the
problem and design can be discussed before review.
-->

<!--
Short blurb explaining:
- What changes did you make?
- Why did you make them?
-->

I worked on ... because ...

#
### Type of change:
<!-- You should choose 1 option and delete options that aren't relevant -->
- [ ] Bug fix
- [ ] Improvement
- [ ] New feature
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation

#
### High-level design:
<!--
REQUIRED for large PRs (new features, refactors, breaking changes, or anything touching >5 files).
Skip for small bug fixes and trivial changes.

Cover:
- Architecture / approach you took and why
- Key components or files added/changed and how they interact
- Alternatives considered and why you rejected them
- Any migration, backward-compatibility, or rollout concerns
- Diagrams or links to design docs / RFCs if available
-->

N/A — small change. <!-- Or fill in the design above -->

#
### Tests:

#### Use cases covered
<!--
List the user-visible scenarios this PR exercises. Example:
- User with Admin role can create a Glossary Term with a parent term
- Ingestion run for Snowflake correctly extracts row counts for partitioned tables
-->

#### Unit tests
<!--
- [ ] I added unit tests for the new/changed logic.
- Files added/updated:
- Coverage on changed classes (run `mvn jacoco:report` for backend, `yarn test:coverage` for UI,
  `make unit_ingestion` for ingestion). Target is 90% line coverage on changed classes.
- Coverage %: <e.g., 92% on EntityRepository.java>
-->

#### Backend integration tests
<!--
- [ ] I added integration tests in `openmetadata-integration-tests/` for new/changed API endpoints.
- [ ] Not applicable (no backend API changes).
- Files added/updated:

PR checks run only the Java unit tests; the integration tests run in the merge queue and JavaUIIT /
search-it nightly. Before requesting review, run the Java tests this PR impacts (selected from
`.github/java-tests/impact-map.json`):

  make java_affected                            # list the impacted unit tests + ITs and the commands
  make java_affected_run ARGS="--update-pr"     # run them and fill the block below

Without `gh`, drop `--update-pr` and paste `target/java-tests/local-pr-results.md` between the markers.
-->
<!-- local-java-test-results:start -->
<!-- local-java-test-results:end -->

#### Ingestion integration tests
<!--
- [ ] I added/updated ingestion integration tests for connector changes.
- [ ] I ran the integration tests covering my changed files locally (PR CI runs only unit tests; the merge queue runs `tests/integration/`).
- [ ] Not applicable (no ingestion changes).
- Files added/updated:
-->

#### Playwright (UI) tests
<!--
- [ ] I added Playwright E2E tests under `openmetadata-ui/.../ui/playwright/` for UI changes.
- [ ] Not applicable (no UI changes).
- Files added/updated:

PR checks do not run Playwright; the merge queue runs the full suite. Before requesting review, run
the specs impacted by this PR locally (selected from `.github/playwright/impact-map.json`):

  make playwright_affected                            # list the impacted specs + the command
  make playwright_affected_run ARGS="--update-pr"     # run them and fill the block below

Without `gh`, drop `--update-pr` and paste `playwright/output/local-pr-results.md` between the markers.
-->
<!-- local-playwright-results:start -->
<!-- local-playwright-results:end -->

#### Manual testing performed
<!--
List the manual test steps you performed before requesting review. Example:
1. Started local stack via `./docker/run_local_docker.sh -m ui -d mysql`
2. Logged in as admin, created entity X, verified Y appears in the UI
3. Triggered ingestion for Snowflake source, confirmed lineage edges in the explore page
-->

#
### UI screen recording:
<!--
REQUIRED as part of creating a PR for a UI feature or a feature task/subtask with UI impact.
Follow skills/ui-pr-recording/SKILL.md (/ui-pr-recording): build the PR code, run it in Docker
with sample data, record the feature and its result, then upload the video to GitHub and embed it
here. Screenshots may supplement, never replace, a required recording.

Include the recorded commit SHA, Docker startup command + health/version checks, sample-data
setup, steps shown and observed results. Re-record after UI/runtime changes. If blocked, leave
this PR as draft and state the blocker and remaining work; a local file or TODO is not evidence.
Standalone fixes, refactors, styling, localization, docs, tests and backend-only work may use
"Not applicable — <reason>". Classify by the task and behavior, not just paths or labels.
-->

<!-- Replace with the uploaded video and evidence, or an explicit N/A reason. -->

#
### Checklist:
<!-- add an x in [] if done, don't mark items that you didn't do !-->
- [x] I have read the [**CONTRIBUTING**](https://docs.open-metadata.org/developers/contribute) document.
- [ ] My PR title is `Fixes <issue-number>: <short explanation>`
- [ ] My PR is linked to a GitHub issue via `Fixes #<issue-number>` above.
- [ ] I have commented on my code, particularly in hard-to-understand areas.
- [ ] For JSON Schema changes: I updated the migration scripts or explained why it is not needed.
- [ ] For a UI feature or feature task: as part of PR creation, I ran the PR build in Docker with sample data and embedded a verified GitHub-hosted recording plus build/health evidence above (or explained why this requirement is not applicable).
- [ ] I have added tests (unit / integration / Playwright as applicable) and listed them above.
- [ ] Decision check: if this PR decides something the next contributor could undo — a schema field, REST path or format another component or repo must agree with, a new default or limit, an ordering that must hold, or a rule stated only in this description — it adds a record under `docs/decisions/` (see its `README.md`). This description is gone from `git log` after the squash-merge.

<!-- Based on the type(s) of your change, uncomment the required checklist 👇 -->

<!-- Bug fix
- [ ] I have added a test that covers the exact scenario we are fixing. For complex issues, comment the issue number in the test for future reference.
-->

<!-- Improvement
- [ ] I have added tests around the new logic.
- [ ] For connector/ingestion changes: I updated the documentation.
-->

<!-- New feature
- [ ] The issue properly describes why the new feature is needed, what's the goal, and how we are building it. Any discussion
    or decision-making process is reflected in the issue.
- [ ] I have updated the documentation.
- [ ] I have added tests around the new logic.
-->

<!-- Breaking change
- [ ] I have added the tag `Backward-Incompatible-Change`.
-->
