# PR code never runs on pull_request_target; fork PRs run unprivileged

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial) · v2 2026-10-20 (the merge queue runs only approved commits)
- **Deciders:** @pmbrull
- **Guard:** `actions/checkout@v7` refuses to fetch fork code under `pull_request_target` unless the step
  sets `allow-unsafe-pr-checkout: true`, which no workflow does; CodeQL's `actions/untrusted-checkout`
  alert; reviewer. v2: `require_last_push_approval` on the `merge-rules` ruleset, which GitHub enforces
  at enqueue; nothing in the tree checks that it stays on
- **Related:** #35420, #35426, ADR:2026-10-13-stale-merge-queue-runs-are-cancelled-by-a-central-sweep

The v2 amendment below replaces the merge-queue consequence: the queue runs only a commit that someone
other than its pusher approved.

## Context
Most PR workflows triggered on `pull_request_target`, which runs in the base repository's context with repo
secrets and a write-capable `GITHUB_TOKEN`. They checked out the PR head and ran it, so the `safe to test`
label (applied automatically for allowlisted authors, stripped on every fork push) was the only thing
between fork code and those secrets. `persist-credentials: false` does not change that: code running in a
job on a hosted runner can read every secret the job references.

None of the required checks needs a secret on a PR. The secrets used at PR time fed Sonar, bot comments,
the Collate build and data-access-request dispatches, and 44 connector credentials in the knowledge-graph
workflow that no RDF spec reads. Meanwhile 49 of 53 open community fork PRs had never been labelled, so
none of their gated checks had run. Since 2025-12-08 `pull_request_target` always runs the default
branch's workflow file, so release-branch PRs were running main's copies.

## Decision
- A workflow that checks out or executes PR code triggers on `pull_request`, never on
  `pull_request_target`.
- `pull_request_target` is only for workflows that never check out PR code: `pr-metadata-validation`,
  `backport-labeled-prs`, `merge-queue-dequeue-report`, `prune-ephemeral-caches`. The team labeler and
  `.github/teams.yml` are gone: they existed to apply the label, and GitHub team settings assign reviewers.
- On `pull_request`, a step that needs a secret or a write token runs only when
  `github.event.pull_request.head.repo.full_name == github.repository && github.actor != 'dependabot[bot]'`:
  Dependabot runs get a read-only token and no secrets even on a same-repo branch. A bot comment's content
  also goes to the job summary and an `::error::` annotation, so fork PRs still see it.
- Secrets reach PR code only on same-repo PRs and in the merge queue; a manual dispatch never runs a fork
  PR's code. There is no `safe to test` label.

## Consequences
- Fork PRs get every required check without a maintainer action; a first-time contributor's runs still
  need GitHub's "Approve and run".
- Fork and Dependabot PRs get no Sonar PR analysis and no bot comments. Their Collate build (including for
  UI-only changes) and data-access-request e2e run in the merge queue instead of at PR time; neither is a
  required check, so a failure there reports but does not block the merge.
- The merge queue runs a PR's latest commit with secrets whether or not that commit was approved
  (`require_last_push_approval` is off on `merge-rules`), so enqueueing a fork PR trusts its latest push.
- `pull_request` reads the workflow from the PR's merge commit, so release branches run their own copies:
  every protected release branch (`1.13`, `2.0` and their open patch branches) needs the same trigger
  change, or its required checks never report.
- `maven-build-collate` reports a PR run, and a queue run standing in for a fork's skipped PR run, to
  Collate's `openmetadata-dispatch.yml` as `pull_request_target`, the event name that file keys its PR mode
  on. Change both sides together.
- A check that genuinely needs a secret for fork PRs belongs in the merge queue, not on
  `pull_request_target`.

## Amendment — v2: the merge queue runs only approved commits

Retiring the label also removed the only maintainer action between a fork push and the merge queue. The
labeler stripped `safe to test` on every fork push (re-adding it only for allowlisted authors), and the
red required check kept the PR out of the queue until a maintainer added it back. Approvals survive later
pushes, so without that step an approved fork PR could take another push, be enqueued, and have the queue
run the unreviewed commit with secrets. In the 30 days before this change, two community fork PRs merged
with an unapproved fork commit on top (#34340, #34875).

- `merge-rules` sets `require_last_push_approval`: a PR enters the merge queue only once someone other
  than its last pusher has approved that push. Only approvals from users with write access count, so a
  fork author cannot satisfy it. Earlier approvals, code owners' included, stay.
- This replaces the consequence above that the queue runs a PR's latest commit whether or not it was
  approved.

Why this rule and not another:
- `merge_group` runs read the workflow files from the merge-group commit, so the PR decides what the
  queue executes. A gate in a `pull_request` or `merge_group` workflow can be edited by the fork it
  gates; a safe fork-only gate would need `pull_request_target` and `workflow_run` plumbing plus a new
  required check.
- Rulesets cannot scope a rule to fork PRs, so every PR carries it.
- `dismiss_stale_reviews_on_push` would drop every approval, code owners' included, on every push.

Cost: 131 of the 900 PRs merged into `main` in those 30 days (15%) were pushed after their last approval
and would have needed one more; 12 of them were pushed by the approver, so a third committer approves.
Another 31 only merged `main` in, which GitHub may not count as a reviewable push. The queue does not need
an up-to-date branch (`strict_required_status_checks_policy` is off), so "Update branch" after approval is
only needed to resolve a conflict. Turning the setting off needs a replacement gate for fork commits in
the queue.
