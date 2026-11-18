# Test results record their execution-time tolerance

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `test_applied_threshold.py`, `testCaseThreshold.utils.test.ts`, `RunDetailsCard.threshold.test.tsx`, `TestCaseResourceIT#test_thresholdSnapshotSurvivesPersistenceAndSearch`
- **Related:** [Issue #37806](https://github.com/open-metadata/OpenMetadata/issues/37806), [PR #37809](https://github.com/open-metadata/OpenMetadata/pull/37809)

## Context

A test case can change after a run finishes. Combining its current tolerance or configured bounds
with a historical verdict misrepresents the evaluation, including when an edit arrives before the
server stores the result. Set-membership tests also change whether they apply a tolerance when
`matchEnum` changes.

## Decision

Ingestion records `appliedThreshold` on the result from the configuration used during execution.
Its `value` and `unit` describe the tolerance; zero means no deviation was tolerated. `applied`
defaults to true for snapshots that omit it. A completed set-membership run with `matchEnum`
disabled records `applied: false`; its value and unit do not explain the verdict. An aborted run
records no snapshot. Custom SQL tests also record none because their `threshold` is an expected
query result, not a failure tolerance.

`configuredMinBound` and `configuredMaxBound` preserve bounds before tolerance widening, alongside
the effective `minBound` and `maxBound`. Unbounded sides are absent; comparing serialized bounds
must treat absence and infinity consistently. Each dimension keeps its own bounds and inherits
the parent run's threshold snapshot.

The server preserves these fields in storage, dimension results, and search responses. It never
fills them from the current test case. Readers use the recorded threshold and applicability,
never current parameter values. A false applicability flag suppresses the tolerance explanation.
A missing snapshot means unknown and is displayed as unavailable for tolerance-capable test
definitions; it must not be inferred as zero or reconstructed from today's settings.

## Consequences

Editing a test case cannot rewrite a historical run's tolerance explanation. Older agents remain
compatible, but results without snapshots cannot recover historical tolerances. The boolean
distinguishes known non-application from missing historical information without changing the
result's verdict or measurements.
