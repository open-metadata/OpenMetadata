# Contributors

We ❤️ all contributions, big and small!

## Before you request review

Review here is **automation-first.** Maintainers lean on CI and the AI review bots, and usually do
not read a PR line by line until the checks are green and the bot threads are resolved — they will
reply "check the bot reviews" and wait. The fastest path to a human review is to arrive with the
gate below already green. Once a maintainer engages, [`REVIEW.md`](REVIEW.md) is the bar the code is
held to. The `pr-checklist` skill (`/pr-checklist`) runs the `REVIEW.md` self-review and fills in the
PR template; the CI and review-bot items below you check on the PR itself.

These conditions come from recent review threads on contributor PRs: what the checks block on, and
what maintainers ask for before they engage.

1. **First-time contributors: wait for "Approve and run".** GitHub holds workflow runs on a first
   PR from a new contributor until a maintainer approves them. There is nothing for you to fix; ask
   in Slack `#contributor` if it sits. No label is involved
   (ADR:2026-10-14-pr-code-never-runs-on-pull-request-target).
2. **`Validate PR Metadata`** (`.github/workflows/pr-metadata-validation.yml`). A hard gate. The PR
   links a GitHub issue (`Fixes #NNNN` in the body or title; the house title convention is
   `Fixes NNNN: <short explanation>`), the issue has a description, and the issue is in the
   **Shipping** GitHub Project with Status, Source, Priority, Domain and Release set (open the issue
   → right sidebar → Projects). `skip-pr-checks` is a maintainer-only bypass.
3. **The PR checks are green.** Drive each one green yourself:
   - **Backend:** `backend-checks` (the `Backend CI` workflow: spotless formatting and the Java unit
     tests).
   - **Python:** `py-checkstyle` (ruff) and `py-tests-status` (unit tests and static checks).
   - **UI:** `ui-checkstyle` (ESLint, Prettier, organize-imports), `browser tests + coverage`, and
     `ui-coverage` (Jest).
   - **Other:** `validate-json-yaml`, `generate-types` (regenerate after any schema change), and
     `docker-image-smoke-test`.
   - Which of these run depends on the paths the PR touches.
4. **AI review-bot threads resolved.** Gitar reviews every PR and posts a verdict (`Approved` /
   `Changes requested` / `Blocked`); Greptile and Copilot may also comment. Treat a `Blocked` or
   `Changes requested` verdict as a blocker. Resolve or answer each thread before asking a
   maintainer to look — "check the bot reviews" is the most common maintainer reply.

**Advisory, not gating, but read them:** the Collate CI result posted on the PR (red means the
change breaks `openmetadata-collate`; see `REVIEW.md` → "Collate builds against OpenMetadata
`main`") and `harness-integrity` (warnings only).

**Not run on the PR at all:** the Java integration tests and Playwright run in the **merge queue**,
and SonarCloud runs on `main` and nightly. A green PR has not run them — run the impacted ones
locally (`make java_affected_run`, `make playwright_affected_run`) and record the results, per the
PR template.

## What maintainers ask for first

Even with the gate green, these are the recurring first asks on contributor PRs. Handle them before
requesting review so the PR does not bounce:

- **Real regression tests, not mocks.** The top substantive ask. Add a test that seeds the real rows
  or runs the real workflow and **fails before your change**. Do not mock the boundary you are
  testing (`REVIEW.md` → "A test that cannot fail is a finding").
- **Fix the named defects.** When a reviewer or a bot points at a concrete correctness or edge case
  (a silently swallowed error, a double count, an existing setup you break), fix it rather than
  deferring it with a comment.
- **One concern per PR, clear intent.** Split unrelated changes into their own PRs and state the goal.
  A PR whose purpose is unclear gets closed, not reviewed.
- **Rebase and clear conflicts with `main`,** and check whether `main` already landed something the
  change now overlaps.
- **A description that states the root cause:** what was wrong, and why the fix is right.
- **UI evidence.** A UI feature needs a screen recording (next section). Changed UI lines are also
  covered by the `browser tests + coverage` check.

There is no CLA or DCO sign-off to complete.

## Pre-flight checklist

- [ ] Linked issue with a description, in the **Shipping** project with its fields set
- [ ] PR checks green for the paths you touched — `backend-checks`, `py-checkstyle` /
      `py-tests-status`, `ui-checkstyle`, `browser tests + coverage`, `ui-coverage`,
      `validate-json-yaml`, `generate-types`, `docker-image-smoke-test`
- [ ] Impacted integration tests and Playwright specs run locally and recorded in the PR
- [ ] Every Gitar / Greptile / Copilot thread resolved or answered
- [ ] A regression test that fails before the fix; nothing mocks the boundary under test
- [ ] One concern; the description states the root cause
- [ ] UI recording for a UI feature (or an explicit N/A reason)
- [ ] Self-review against [`REVIEW.md`](REVIEW.md), every 🔴 fixed or answered

## Creating a UI feature pull request

When creating a PR for a UI feature or a feature task/subtask with UI impact, run the PR build in
Docker with sample data and include a GitHub-hosted screen recording in its description. Show the
feature and its result, and include the recorded commit, startup/health checks and sample-data
setup. Screenshots supplement
the video; they do not replace it. Follow [UI PR recording](skills/ui-pr-recording/SKILL.md), or
invoke `/ui-pr-recording`. Keep the PR draft if setup, recording or upload is blocked. Standalone
fixes, refactors, styling, localization, docs, tests and backend-only changes may explain N/A.
This step belongs to PR creation; it is not required for every implementation task or standalone
review. Automated tests are still required where applicable.

## Getting started

Read [Build Code and Run Tests](https://docs.open-metadata.org/developers/contribute/build-code-and-run-tests) for how to setup your local development environment. Get started with our [Good first issues](https://github.com/open-metadata/OpenMetadata/issues?q=is%3Aissue+is%3Aopen+label%3A%22good-first-issue%22).

For Python work in this checkout, use the [locked local Python environment guide](DEVELOPER.md#locked-local-python-environments).
It documents the profiles, their Make commands, the Nox sessions and their bootstrap,
and how application synchronization affects an existing `env/`. `make install_dev_env`
prepares the full test profile; formatting and generation use separate tool environments.

We also recommend joining the OpenMetadata [Slack Workspace](https://slack.open-metadata.org/) to meet the team, stay up to date with product features, and chat with other contributors! 

Once joining our Slack we recommend Introducing yourself in the #introductions channel. Tell us a bit about yourself and how you are currently using OpenMetadata if you are.

If you need help getting started in contributing, you can reach out in the #support channel and ask if anyone would be available to get you up to speed or just answer some questions.  

If you just have suggestions for how to improve OpenMetadata you can submit your feedback in #feature-requests. If you have a fix or contribution in mind but need some guidance, please post in the #contributor channel with a description of the change before opening a new Github issue. 
