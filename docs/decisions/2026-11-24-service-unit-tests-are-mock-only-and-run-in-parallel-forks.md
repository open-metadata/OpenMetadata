# openmetadata-service unit tests are mock-only and run in parallel forks

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `openmetadata-service/pom.xml` has no Testcontainers dependency, so a container test
  there does not compile
- **Related:** #38614

## Context

The `openmetadata-service-unit-tests` job ran 32 to 47 minutes per PR on 2026-11-24. Surefire ran
all 1,589 classes serially in one JVM. 56 of those classes started Testcontainers databases,
search engines, Redis or LocalStack, and they took 33.0 of the 44.5 minutes of test time. Most of
it came from `OntologyTestDatabase`, which started a new database container for each test
invocation.

`openmetadata-integration-tests` already starts one database, one search engine and, in the cache
lane, one Redis per forked JVM, and runs each engine pair in its own CI lane.

## Decision

- Unit tests in `openmetadata-service` mock their boundaries. A test that needs a real database,
  search engine, Redis or AWS service is an `*IT` in `openmetadata-integration-tests` and uses the
  infrastructure `TestSuiteBootstrap` starts. It does not start its own container.
- SQL and migration tests that build their own schema use `ScratchDatabase`: an empty database on
  the lane's server, dropped afterwards. They run in the lane's dialect, so the MySQL and
  PostgreSQL lanes each cover one.
- A topology the shared services cannot provide (a Redis cluster, a container the test pauses,
  LocalStack) comes from an on-demand `TestSuiteBootstrap` helper, started once per JVM.
- Surefire in `openmetadata-service` runs `unitTests.forkCount` JVMs (default `1C`, one per CPU)
  with `reuseForks`. A test that fails only under forks has an ordering or shared-state bug. Fix
  it rather than running the suite serially again.

## Consequences

The unit job no longer needs Docker. The moved tests run in the merge-queue IT lanes instead of on
every PR, so a PR that touches their code runs them with the `java-affected-tests` skill before it
merges. A parameterized MySQL/PostgreSQL test runs one dialect per lane, so the per-lane test count
of those classes halves while the total coverage is unchanged.
