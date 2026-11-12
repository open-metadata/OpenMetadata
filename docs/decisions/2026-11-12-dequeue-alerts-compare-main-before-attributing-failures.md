# Dequeue alerts compare main before attributing failures

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** reviewer
- **Related:** ADR:2026-11-09-dequeue-alerts-separate-observed-causes-from-attribution

## Context

Naming a failed workflow and step does not tell maintainers whether a dequeue needs their
attention. The alert must distinguish a likely PR regression from a failure already on main,
and reserve RCA for main failures. A green summary job is not evidence that tests passed.

## Decision

The reporter reads existing Playwright JSON and JUnit artifacts, job logs and commit history.
It adds no producer steps and dispatches no runs. It compares the same workflow and job with
executed tests at the queue's exact main base, taken from GitHub's merge-queue branch suffix.
A queue run whose commit became that main base is also a valid baseline. Skipped jobs, missing
reports and other commits cannot serve as passing baselines.

Comparisons require matching workflow contents, runner labels and available test-run configuration.
The job checkout must match its run commit. Attempt-scoped Playwright uploads reuse the existing
artifact selector so a successful retry upload supersedes an incomplete primary upload. Existing
failed-test annotations remain a display fallback and never establish attribution.
The test identity and normalized
error, including every attempt error, its recorded stack and location, must match to classify a failure as main.
A recorded pass supports a likely PR/merge-group
error. Different errors across retries, flaky passes, conflicting baseline results and unavailable
evidence remain unknown. Mixed failures keep their separate counts; one main failure cannot clear
other failures. Attribution concerns the merge group, not necessarily the individual PR.
Each independent failed job is compared; the repository's known summary gates are listed with
their upstream failure instead of receiving their own attribution.
Global Playwright errors remain unresolved evidence. A consumer job's checkout does not establish
the revisions of downloaded build bundles, distributions or generated models. These jobs remain
unknown until producer provenance is available; their failed test names are still shown.

Both destinations lead with `PR vs. main`. A blue circle marks a likely PR/merge-group error, a
siren marks any confirmed main failure, and a warning marks unknown attribution. Failed test
names and links remain visible. Neither destination includes a Next steps or What happened section.
Only main failures receive RCA. RCA uses a fixed description of the observed failure and links
the matching main run; it does not copy raw errors, credentials or URLs out of logs.

For a main failure, walk at most 20 first-parent commits backward. Name an introducing commit
only when matching failure evidence is continuous back to a commit whose immediate parent passed
the same test in a comparable environment. Label this as the first matching failure after a passing
parent, not proof of the underlying code defect. Missing evidence or the history limit produces
an explicit unknown introducing commit instead of guessing. Compare at most 10 runs per exact
baseline commit; exceeding that limit leaves attribution unknown. These limits bound API work
without turning an incomplete search into certainty.

Each report archive and its selected uncompressed contents are bounded to 16 MiB. Job logs used
to recover resolved dependency revisions are bounded to 64 MiB. Downloads do not forward the
GitHub token to redirected storage hosts. Artifacts are read without extracting or executing them.
API and baseline caches hold at most 128 entries each; the larger parsed snapshots hold at most 16.

## Consequences

An alert can distinguish a routine rejected PR from a shared failure when comparable evidence
exists. Existing artifact retention, failure-only uploads and skipped main-base jobs can still leave attribution or the
introducing commit unknown. Unsupported report formats stay unknown. A reported pass-to-fail
boundary is evidence of the first observed failing commit, not a causal explanation of a flake.
The reporter preserves notifications when auxiliary reads fail. Per the maintainer's existing
instruction, this internal helper has no automated tests or dedicated test workflow; changes use
syntax, formatting, reference checks, code review and local replays outside the reporting workflow.
