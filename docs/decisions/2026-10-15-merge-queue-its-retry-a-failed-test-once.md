# Merge-queue integration tests retry a failed test once, and a failed dependency download up to three times

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Sonika Shah (agreed in #ci-cleanup)
- **Guard:** reviewer
- **Related:** #34892 (ITs run only in the merge queue); #35469; `TestSuiteBootstrap`; the three
  `integration-tests-*.yml` workflows

## Context

Since #34892 the Java integration tests run only in the merge queue, so one failed run ejects the
pull request and restarts every entry queued behind it. Each IT workflow runs about 17,000 tests
across five lanes, and about 3–5% of merge-queue runs per workflow failed on a test that the
pull request did not touch. In the 12 hours after #35469, six entries were ejected:

- four by tests that fail only under the parallel lane's concurrent load (an edit-lock deadlock on
  MySQL, a search update dropped on a version conflict, the single-threaded workflow consumer
  running minutes behind, a count over shared fixtures);
- two by lanes that died before any test ran, because Maven Central dropped the connection while
  the lane downloaded test dependencies.

Fixing each flaky test is still required, but a new one will appear before the old ones are all
fixed, and until then every occurrence costs the queue an hour.

## Decision

- The merge-queue IT lanes pass `-DintegrationTests.rerunFailingTestsCount=1`. After the lane's
  tests finish, failsafe re-runs only the failed test methods, once, in the same JVM. A test that
  passes on the re-run is reported as a flake (`<flakyFailure>`) and does not fail the lane; a test
  that fails twice fails it. The property defaults to `0`, so local runs are unchanged.
- Failsafe closes the JUnit launcher session between the two passes. `TestSuiteBootstrap` therefore
  tears the infrastructure down in a JVM shutdown hook rather than in `launcherSessionClosed`, so
  the re-run pass reaches the same server. `forkedProcessExitTimeoutInSeconds` is 180 so the forked
  JVM can finish that teardown.
- The re-run runs in the same JVM, where `TestNamespace.prefix` would hand it the failed attempt's
  names, and whatever that attempt (or its class's `@BeforeAll`) created and did not track as a
  root is still there. When the second launcher session opens, `TestSuiteBootstrap` calls
  `TestNamespace.startRetryPass()`, which changes every prefix from then on — method- and
  class-level, extension-made or hand-made — so the re-run creates fresh entities instead of
  failing on a 409. JUnit re-runs the failed test's `@BeforeAll` in that pass.
- A lane re-invokes `mvn verify` up to three times, 30 seconds apart, only when the attempt failed
  with a dependency-resolution error within 10 minutes and wrote no failsafe report. A test
  failure or a hang is never retried this way. Before each retry it deletes `~/.m2/**/*.lastUpdated`:
  Maven caches a "not found" there and would otherwise not ask Central again.

## Consequences

- A flaky test no longer ejects a pull request; a deterministic failure still does. A green lane
  costs no extra time. A retried test costs its own duration again, within the lane's 65-minute
  limit.
- Flakes stay visible: each lane annotates the tests that passed only on retry, and after a green
  merge-queue run the workflow posts them, with the PRs and the run, to #ci-cleanup. They still need
  an owner; the retry is a safety net, not a substitute for fixing them.
- A test that only passes on a quiet server can now merge. That is the trade-off accepted here.
- A pull request that adds a dependency that does not exist spends two extra attempts (about a
  minute) before it fails.
- Revisit if the flake count does not fall, or if a retried test is found to hide a real
  regression.
