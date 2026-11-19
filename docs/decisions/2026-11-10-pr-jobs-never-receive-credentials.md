# PR jobs never receive credentials, including same-repository PRs

- **Status:** Accepted
- **Revisions:** v1 2026-11-10 (initial) · v2 2026-11-10 (manual checkouts retain their event cache scope)
- **Deciders:** @pmbrull
- **Guard:** `.github/scripts/check_pr_workflow_security.py` and its regression tests run in
  `validate-jsons-yamls.yml`; reviewer checks credential access through actions, scripts, and runners.
- **Related:** #35426

## Context

The earlier decision withheld credentials from forks and Dependabot but allowed same-repository
PR jobs to use secrets and write tokens. That exception lets a change to a build script, test,
action, or workflow expose credentials before review. The review rule now requires every PR job
to run without those credentials. The workflows and decision record must enforce the same rule.

## Decision

- Every job reachable from `pull_request` uses a read-only `GITHUB_TOKEN` and no repository,
  organization, or environment secrets. This includes same-repository PRs and Dependabot.
- PR jobs do not request OIDC tokens, select environments with credentials, persist checkout
  credentials, or run on runners with ambient credentials.
- Local reusable workflows follow the same rule. PR callers do not forward secrets or use
  `secrets: inherit`. Credential access in a later step on the same runner is still access by PR code.
- A credential-backed job in a workflow with multiple triggers has an explicit job condition
  excluding `pull_request`. Same-repository checks, labels, and earlier approvals are not exemptions.
- Credential-backed checks run on trusted branch pushes or nightly runs. The Collate and DAR
  dispatches also run for approved merge groups against the immutable group SHA. Their manual
  runs use the protected `2.0` branch.
- Before merging or entering a queue, the latest reviewable push needs approval from someone
  other than its pusher. Ruleset bypass actors remain explicitly trusted exceptions. Approval
  authorizes execution of the reviewed code with credentials. Approval does not prevent malicious
  approved code from exposing credentials.
- The earlier ban on executing PR code under `pull_request_target` remains. Privileged metadata
  automation uses trusted code and never executes PR scripts, artifacts, or caches.

## Consequences

- PR CI retains format, generation, unit-test, and coverage checks. Results appear in annotations,
  logs, artifacts, and job summaries rather than PR comments from jobs with write tokens.
- Sonar PR scans are removed. UI and ingestion Sonar analysis remains in their existing nightly
  workflows; GitHub does not schedule those copies on release branches. Airflow API Sonar analysis runs in a separate job after a trusted `2.0` push or manual test run.
- Type and impact-map generation no longer auto-commit with a PAT. Authors commit generated
  changes locally. Fork impact-map checks retain the planner's full-suite fallback.
- Live SSO tests use environment credentials and run manually on `2.0`.
  Mock OIDC tests remain credential-free on PRs.
- Without an OSS merge queue, credential-backed checks are deferred until after merge or a trusted
  manual run on this release branch. This delays regression detection. It does not justify giving PR jobs credentials.
- The static guard rejects direct and dynamic secret references, secret forwarding, environments,
  write permissions, and persisted checkout credentials in PR-reachable local job graphs. It
  recognizes explicit event exclusions and treats unknown conditions as reachable. Review still
  checks third-party actions, runner setup, and changes to the guard itself.

## Amendment — v2: manual checkouts retain their event cache scope

The runner can write Actions caches even when its `GITHUB_TOKEN` is read-only. A manual run on
`main` that checks out a separately supplied PR or branch can let unreviewed code poison a cache
that trusted jobs restore later.

Type generation and impact-map validation remove their `pr_number` and `branch` inputs. PR runs
check out the PR head SHA. Manual runs check out `github.sha`, matching the run's ref and cache
scope. The workflow ref selector still supports manual runs without executing another revision
under the default branch's cache scope. Regression tests verify both checkout contracts.
