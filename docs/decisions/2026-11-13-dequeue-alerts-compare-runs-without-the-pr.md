# Dequeue alerts compare the failed run with runs that do not contain its PRs

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** reviewer
- **Related:** ADR:2026-11-12-dequeue-alerts-compare-main-before-attributing-failures

## Context

The previous record compared a failed queue job only with the same job at the queue's exact main
base, in a matching environment. That evidence almost never existed. A merge group that touches no
end-to-end path skips Playwright, so the base rarely ran the suite. Duration-balanced shards move
tests between jobs. Every Collate run builds against the current OpenMetadata and ai-platform tips,
so no two environments matched. On 2026-11-12 every alert read Unknown while one OpenMetadata
change failed the same tests in every queue run that executed them.

## Decision

Only the dequeue reporter decides; no producer step or extra run is added. For each failed run
that blocked the queue, it reads GitHub's record as of the dequeue and compares the failures with
earlier completed runs of the same workflow that share no queued PR with the failed run. Those are
main pushes, schedules and dispatches, and merge groups whose queue chain excludes every PR in the
failed run's chain. The chain is the PR of each `gh-readonly-queue/<branch>/pr-<n>-<base>` branch,
followed through bases that are not on main. A main run that passed supersedes merge-group results
on its commit or an older base: main was green there, so their failures are their own PRs'.

Failed tests match by name across all of a run's Playwright JSON and JUnit report artifacts. A run
whose reports name no failed test compares its failed jobs by name and failed step instead. A
summary gate is never evidence, because it also passes when its upstream jobs skip; a run where
only the gate failed gets its own Unknown line and does not set the alert's icon. A failed job
whose logs show a dependency download or network error is reported as **Infrastructure**, with no
history comparison. Two failures are the same when their failing file and first error line agree,
with numbers ignored.

The newest comparable run that executed a failure decides it:

- the same failure: **Main** (🚨);
- a pass, or no such test in a run that has every report the failed run has: **Likely
  PR/merge-group error** (🔵);
- a flaky or different result, or no comparable run: **Unknown** (⚠️), naming that one reason.

A pass is not discounted when OpenMetadata or ai-platform changed since; the verdict names that
change and links its compare range. In the replayed week a pass followed by a dependency change was
almost always the PR's failure, and treating it as Unknown made nearly every alert Unknown. A
dependency break reads Main, with its range, from the next comparable run that fails the same way.
A run's dependency revisions are those logged by its earliest job with a `Checkout submodules` or
`Checkout dependencies` step, where Collate keys its build bundle on them. OpenMetadata checks out
no submodule and has none to compare.

Only Main receives RCA: a fixed symptom with the failing file and line, and the changes between
the last comparable run that passed and the first that failed. A single change is named as the
introducing commit, several are linked as one compare range per repository, and none means the CI
environment changed. Alerts never copy error text or log lines.

Limits: 100 runs per event listing, 40 comparable runs scanned, 12 with results read, 16 MiB per
report archive, the first 2 MiB of a job log, and 150 seconds per alert. A limit leaves the
affected failures Unknown.

## Consequences

The first alert after a dependency break can read as a likely PR error, with the breaking range
named in it. A test that only flakes on main reads the same way when the newest comparable run
passed it. Suites that run only in the queue need another merge group to have executed them. Per
the maintainer's instruction the reporter has no automated tests; changes are verified by
replaying recorded dequeues locally and dispatching the workflow as a dry run.
