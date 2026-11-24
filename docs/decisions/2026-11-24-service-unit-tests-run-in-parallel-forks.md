# openmetadata-service unit tests run in parallel forks

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** reviewer
- **Related:** #38614

## Context

The `openmetadata-service-unit-tests` job ran 32 to 47 minutes per PR on 2026-11-24. Surefire ran
all 1,589 classes serially in one JVM. 56 of those classes use Testcontainers databases or search
engines, and they took 33.0 of the 44.5 minutes of test time. Most of it came from
`OntologyTestDatabase`, which started a new database container for each test invocation.

## Decision

- Surefire in `openmetadata-service` runs `unitTests.forkCount` JVMs (default `1C`, one per CPU)
  with `reuseForks`. Each fork has its own copy of the static `Entity` registry.
- Docker-backed tests stay in this suite. A test harness starts a container once per fork and
  isolates each test inside it, for example with a database per test, not a container per test.
- A test that fails only under forks has an ordering or shared-state bug. Fix it rather than
  running the suite serially again.

## Consequences

Measured locally with 4 forks, the whole suite ran 18,771 tests in about 6 minutes. A fork costs
one JVM and its own containers, so memory grows with the fork count. Lower it with
`-DunitTests.forkCount=<n>` on a small machine.
