# PR code never runs on pull_request_target; fork PRs run unprivileged

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** @pmbrull
- **Guard:** `actions/checkout@v7` refuses to fetch fork code under `pull_request_target` unless the step
  sets `allow-unsafe-pr-checkout: true`, which no workflow does; CodeQL's `actions/untrusted-checkout`
  alert; reviewer
- **Related:** #35420, ADR:2026-10-13-stale-merge-queue-runs-are-cancelled-by-a-central-sweep

## Context
Most PR workflows triggered on `pull_request_target`, which runs in the base repository's context: repo
secrets, a write-capable `GITHUB_TOKEN`, and main's cache scope. They checked out the PR head and ran it,
so the `safe to test` label (applied automatically for allowlisted authors, stripped on every fork push)
was the only thing between fork code and those secrets. `persist-credentials: false` does not change that:
code running in a job on a hosted runner can read every secret the job references.

None of the required checks needs a secret on a PR. The secrets used at PR time fed Sonar, bot comments,
the Collate build and data-access-request dispatches, and 44 connector credentials in the knowledge-graph
workflow that no RDF spec reads. Meanwhile 49 of 53 open community fork PRs had never been labelled, so
none of their gated checks had run. Since 2025-12-08 `pull_request_target` always runs the default
branch's workflow file, so release-branch PRs were running main's copies.

## Decision
- A workflow that checks out or executes PR code triggers on `pull_request`, never on
  `pull_request_target`.
- `pull_request_target` is only for workflows that never check out PR code: `team-labeler`,
  `pr-metadata-validation`, `backport-labeled-prs`, `merge-queue-dequeue-report`, `prune-ephemeral-caches`.
- On `pull_request`, a step that needs a secret or a write token runs only when
  `github.event.pull_request.head.repo.full_name == github.repository`. A bot comment's content also goes
  to the job summary and an `::error::` annotation, so fork PRs still see it.
- Secrets reach PR code only on same-repo PRs and in the merge queue. There is no `safe to test` label.

## Consequences
- Fork PRs get every required check without a maintainer action; a first-time contributor's runs still
  need GitHub's "Approve and run".
- Fork PRs get no Sonar PR analysis, no bot comments, and no PR-time Collate build or data-access-request
  e2e. The merge queue builds Collate against backend changes; a fork PR that changes only UI code is first
  built in Collate by the push to main.
- `pull_request` reads the workflow from the PR's merge commit, so release branches run their own copies:
  each release branch needs the same trigger change, or its required checks never report.
- `maven-build-collate` reports a PR run to Collate's `openmetadata-dispatch.yml` as `pull_request_target`,
  the event name that file keys its PR mode on. Change both sides together.
- A check that genuinely needs a secret for fork PRs belongs in the merge queue, not on
  `pull_request_target`.
