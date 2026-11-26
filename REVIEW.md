# Review instructions

## How to review

Read the release branch diff and the affected jobs, actions, scripts, and callers in full.
Map every changed behavior to a test. For each finding, identify a concrete trigger, the wrong
result, and a code or test fix. Report credential exposure, broken checks, lost test coverage,
and incorrect success reporting as 🔴 Important findings; fix them before merge.
Review the current PR head. Zero findings is a valid result when the evidence supports it.

### CI credentials and PR code

ADR:2026-11-10-pr-jobs-never-receive-credentials supersedes the earlier same-repository exception.
Run `python3 .github/scripts/check_pr_workflow_security.py` after workflow changes.

- **New or modified `pull_request` jobs run without secrets.** This applies to fork, same-repository,
  and Dependabot PRs. Do not expose repository, organization, or environment secrets. The built-in
  `GITHUB_TOKEN` is allowed with read-only permissions. Checkouts of PR code set
  `persist-credentials: false`. Do not grant `id-token: write` or use runners with credentials that
  PR code can reach.
- **Trace indirect credential access.** Read the job's callers, reusable workflows, composite
  actions, and scripts. Check `secrets: inherit`, secret-backed inputs and environment variables,
  generated tokens, and cloud authentication. Treat credentials in another step on the same runner
  as reachable by PR code. Log masking does not prevent exfiltration.
- **Exclude PRs from jobs that need secrets.** In workflows with multiple event triggers, require
  an explicit job condition that excludes `pull_request` before credentials become available.
  Run those checks on trusted branch pushes or nightly runs. An approved merge group may run them
  against its immutable SHA when the queue is enabled. Labels, earlier approvals, and same-repository
  guards do not exempt a `pull_request` job from this rule.
- **Keep privileged automation separate from PR execution.** `pull_request_target` and privileged
  `workflow_run` jobs must not execute PR code, scripts, artifacts, or caches. A downstream dispatch
  must not give unapproved PR code access to secrets. Trace the executed ref through every dispatch
  and checkout. Report a credential path that violates these rules as a 🔴 security finding. Include
  the event, executed ref, and credential source.
- **Keep manual checkouts in their event's cache scope.** A read-only `GITHUB_TOKEN` does not
  remove the runner's cache-write capability. A manual run on `main` must not execute a separately
  supplied PR or branch while using `main`'s cache scope. Generation workflows check out the event
  SHA on manual runs. Use `pull_request` for PR code so its caches remain scoped to that PR.

