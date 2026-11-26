# Contributors

We ❤️ all contributions, big and small!

## Before you request review

We want to get you useful feedback as quickly as possible. Most of the first round of feedback on a
PR comes from CI and the AI review bots, and it arrives within minutes. A maintainer's time goes
much further on a PR where that first round is already handled. So before you ask a maintainer to
look, please work through the steps below. When CI is green and the bot comments are answered, a
maintainer can go straight to the design and the logic. That is where human review helps you most.

Once a maintainer picks the PR up, they review it against [`REVIEW.md`](REVIEW.md). Reading it
yourself is a good way to see what they will look for. The `pr-checklist` skill (`/pr-checklist`)
can run that self-review for you and fill in the PR template. You will check the CI and bot items
below on the PR itself.

1. **First PR here? Your CI runs need a maintainer's "Approve and run".** GitHub holds workflow runs
   on a new contributor's first PR until a maintainer approves them. You don't need to do anything.
   If it has been waiting a while, give us a nudge in Slack `#contributor`
   (ADR:2026-11-10-pr-jobs-never-receive-credentials).
2. **Link an issue (`Validate PR Metadata`).** Every PR is tied to a GitHub issue, so the problem
   and its context live in one place. Put `Fixes #NNNN` in the body or title; by convention the
   title reads `Fixes NNNN: <short explanation>`. The issue needs a description, and it needs to be
   in the **Shipping** GitHub Project with Status, Source, Priority, Domain and Release set (open the
   issue → right sidebar → Projects). If you can't set those fields yourself, ask in the PR and a
   maintainer will help (`.github/workflows/pr-metadata-validation.yml`).
3. **Get the PR checks green.** Which checks run depends on the paths you touched:
   - **Backend:** `backend-checks` (the `Backend CI` workflow: spotless formatting and the Java unit
     tests).
   - **Python:** `py-checkstyle` (ruff) and `py-tests-status` (unit tests and static checks).
   - **UI:** `ui-checkstyle` (ESLint, Prettier, organize-imports), `browser tests + coverage`, and
     `ui-coverage` (Jest).
   - **Other:** `validate-json-yaml`, `generate-types` (regenerate after any schema change), and
     `docker-image-smoke-test`.

   If a failure looks unrelated to your change, say so in the PR and we'll take a look.
4. **Go through the review bots' comments.** Gitar reviews every PR and posts a verdict (`Approved`
   / `Changes requested` / `Blocked`); Greptile and Copilot may also comment. These bots often catch
   real bugs, so a `Changes requested` or `Blocked` verdict is worth handling first. They are not
   always right, though. If you disagree with a finding, a short reply explaining why is a perfectly
   good answer. Resolving or answering each thread before you ask for a human review saves a round
   trip for both of us.

**Worth a look, but not blocking:** `Compatibility checks` is the status Collate CI posts on the PR
from the `openmetadata-collate` repository; there is no workflow for it in this repository. Red
means the change would break Collate. Mention it in the PR and we'll help work out the fix (see
`REVIEW.md` → "Collate builds against OpenMetadata `main`"). `harness-integrity` only warns.

**Not run on the PR:** the Java integration tests and Playwright run in the **merge queue**, and
SonarCloud runs on `main` and nightly. If your change touches them, run the impacted ones locally
(`make java_affected_run`, `make playwright_affected_run`) and paste the results into the PR
template. That way nothing surprises you after approval.

## What maintainers usually ask about

These come up again and again in first reviews. Covering them up front usually means a shorter
review:

- **Tests that exercise the real behavior.** This is the most common request. A test that seeds
  real rows or runs the real workflow, and that fails without your change, is the strongest evidence
  a fix works. Mocking the very thing you're testing tends to hide bugs rather than catch them
  (`REVIEW.md` → "A test that cannot fail is a finding").
- **The edge cases a reviewer or bot points out.** When someone names a concrete case (a swallowed
  error, a double count, an existing setup that would break), fixing it in the PR is usually quicker
  than coming back to it later.
- **One change per PR, with a clear goal.** Smaller, focused PRs get reviewed faster and are easier
  to merge. If you have several unrelated improvements, separate PRs are very welcome. A sentence on
  what you set out to do helps the reviewer a lot.
- **Up to date with `main`.** Rebasing and resolving conflicts keeps the review on the current code.
  It also shows whether something recently merged overlaps with your change.
- **The root cause in the description.** A few lines on what was wrong and why your fix addresses it
  make the review much faster. Reviewers really appreciate a good write-up.
- **UI changes you can see.** A UI feature needs a short screen recording (see the next section).
  Changed UI lines are also covered by the `browser tests + coverage` check.

There is no CLA or DCO to sign.

## Pre-flight checklist

A quick list to run through before you ask for a review:

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
