# Java test selection

Where each Java suite runs:

| Suite | PR checks | Merge queue | Nightly | Before you open the PR |
| --- | --- | --- | --- | --- |
| Unit tests (`openmetadata-service`, `openmetadata-k8s-operator`) | full | full | — | impacted classes |
| Integration tests (`openmetadata-integration-tests`, every lane, MySQL+ES / PostgreSQL+OS / +Redis) | reports skipped | full | — | impacted classes |
| search-it (`tests/search/*IT`) | — | — | openmetadata-nightly | impacted classes |
| JavaUIIT (`*UIIT`) and scale-it (`tests/search/scale/**`) | — | — | openmetadata-nightly | not run; reported |
| Collate build + unit tests against the OSS change (`maven-collate-ci`) | yes | — | — | — |
| Collate integration tests against the OSS change (`maven-collate-ci`) | — | yes | — | — |

The integration tests are gone from PR checks, so the merge queue is the first place CI sees an
IT failure, and an ejection there costs every PR queued behind it. The local run is the gate:

```bash
make java_affected                              # list the impacted tests + the exact commands
make java_affected_run                          # run them, write target/java-tests/local-pr-results.md
make java_affected_run ARGS="--update-pr"       # also upsert the results block in the PR body (needs gh)
```

## How tests are selected

`.github/scripts/plan_local_java_tests.py` diffs the branch against `origin/main` (`--base` to
change it; uncommitted and untracked files count). Each changed file adds tests, and nothing
removes them:

1. **Changed tests** run as they are.
2. **Areas.** `areas` in `impact-map.json` own code by directory (`sources`) and tests by name or
   path pattern (`tests`). A change runs the tests of every area that owns the file. An area never
   lists a single test: ownership is a rule, so a new test that follows the naming is covered.
3. **Entity names.** `XRepository`, `XResource`, `XMapper`, `XIndex`, the entity schema `x.json`,
   `createX.json` and `x_index_mapping.json` select every IT named `X…` at a CamelCase boundary:
   `Table` selects `TableResourceIT` and `TableCertificationPropagationIT`, not `TablesFooIT`.
4. **ITs that name the change.** ITs that mention the changed class, directly or through IT
   helpers and the SDK (`AuthBackend` → `TokenRefresher` → `SdkClients`). A changed method counts
   where its class is named too: `TestCaseDeleteResilienceIT` names
   `TableRepository.entitySpecificCleanup`. A class that imports a different class of the same
   simple name doesn't count. A helper most ITs go through (`SdkClients`, the IT bootstrap) is
   followed only through its methods that use the change: if a change breaks it outright, every
   IT fails, so any selection catches that.
5. **Callers' entities.** Production code that calls the changed class adds its entity's ITs:
   `TestCaseRepository` calls `TableRepository`, so the `TestCase…` ITs run. When the diff names
   the changed methods, only callers of those methods (or of the class's methods that call them)
   count.
6. **Unit tests by reference.** `XTest`, plus every unit test that mentions `X`. Past
   `unitTestReferenceCap` users in one module, that module's full suite runs.
7. **Smoke.** Any change to code other than a test class adds the `smoke` set.

When the planner can't place a change, it runs more, never less. The **full suite** — every
merge-queue lane IT on the default engine — runs when:

- a production file no area owns changes (an impact-map gap);
- `sharedInfrastructure` changes: poms, the shaded search clients, the IT bootstrap and
  resources, `BaseEntityIT` / `BaseServiceIT`;
- an area marked `fullSuite` changes: `core`, the entity framework and server wiring every IT
  goes through;
- a helper most ITs use changes and the diff names no changed method;
- the selection already holds more than 60% of the merge-queue ITs.

A full-suite plan can run locally, or in CI on your branch:

```bash
gh workflow run "Integration Tests - MySQL + Elasticsearch" --ref <branch>
make java_affected_run ARGS="--ci-run <run-id> --update-pr"   # records the passed run; runs the rest locally
```

`--ci-run` accepts only a passed run of an integration-test workflow (`maven.ciWorkflows`) on
`HEAD` whose lane jobs ran and passed (a run whose change detection skipped them still concludes
"success"), and stands in for the lane steps on that workflow's engine. Unit steps and suite
steps such as search-it still run locally.

Each selected IT runs in the failsafe execution CI uses for it, read from
`openmetadata-integration-tests/pom.xml`. Classes in `integrationTests.globalStateTests`,
`multiNodeTests` and `retryQueueTests` run in the isolated fork. `rdfTests` run in the rdf lane,
which starts Fuseki. `tests/search/*IT` run under `-Psearch-it`. Everything else runs in the
parallel lane. Every command names its engine profile (`-Pmysql-elasticsearch` by default),
because a lane run without one executes zero tests and still prints `BUILD SUCCESS`.

What never runs is read from the code too: abstract classes, class-level `@Disabled`, classes a
suite profile's `<excludes>` drops, and classes enabled only by a system property no lane sets
(reported as not run locally). `notRunLocally` names the suites that run elsewhere (JavaUIIT and
scale-it, nightly).

Engines: an area's `engines` and the `engineRules` add engines. Postgres SQL runs on
`postgres-opensearch`, DAO changes run on both databases, OpenSearch client code runs on
`postgres-opensearch`, and cache code also runs with Redis (`cache-tests`). `testEngines` routes
a class whose tests all assume one backend: by path pattern, or by an `assumes` regex over the
test source (a class that skips unless `searchType=opensearch` runs on `postgres-opensearch`).
A suite profile picks its backend from `-DdatabaseType`/`-DsearchType` through its `engines`
table.

Every command uses `-am`, so the reactor builds the modules under test from this checkout instead
of resolving them from `~/.m2`. Another checkout can overwrite those jars mid-run, and a stale jar
silently tests old code. Unit steps run `package` because the relocated `es.*`/`os.*` search
clients only exist once `openmetadata-shaded-deps` is packaged. IT steps pass a `-Dtest` filter
that matches nothing, so `-am` doesn't also run every upstream unit suite.

`--run` clears the report directories before each step and fails a step that ran zero tests or
left a selected class without a report. It refuses to start the ITs while another Testcontainers
stack is running (`--allow-concurrent` overrides), because two stacks rarely fit in Docker's
memory.

## What the author adds

The plan is a floor. The author, or the agent writing the change, adds what the plan can't know
about and says why; nothing takes tests out:

```bash
make java_affected_run ARGS='--add-area lineage --add-it TableResourceIT --reason "changes the edge payload lineage reads" --update-pr'
```

`--reason` is required with any `--add-*`, and the PR block lists the additions under it. Pass
them to the run, not only the plan: nothing is saved between the two.
`skills/java-affected-tests` has the ground rules for when to add.

## Changing the map

- New code in an owned directory, and a new IT whose name matches an area's pattern, need no edit.
- `make java_affected ARGS=--check-map` and the `java-impact-map` harness check report an IT or a
  production file (under `ownedRoots`) no area owns, an area that names a single test, patterns
  that match nothing, and engines the IT pom lacks. Until someone assigns an unowned file, a
  change to it runs the full suite.
- Test patterns without a `/` match the class's simple name (`Search*IT`). Patterns with a `/`
  match its path under `openmetadata-integration-tests/src/test/java`. Source and test globs use
  `fnmatch`, where `*` crosses directories: `…/java/org/openmetadata/*.java` matches every Java
  file below `org/openmetadata/`, not only the ones directly in it.
- To trade recall for time, move code out of `core` or narrow an area's patterns; to trade time
  for recall, add patterns. Check the effect with the planner on real diffs.
- Validate with `python3 -m pytest .github/scripts/test_plan_local_java_tests.py`.

The script holds no repo-specific knowledge beyond these defaults. `maven.lanes` (membership read
from `pomProperties` or a failsafe execution's `pomExecutionIncludes`), `maven.suites`,
`maven.unitPhase`, `maven.testSideSources`, `maven.ciWorkflows`, `ownedRoots` and `prHeading` let
openmetadata-collate run the same file with its own map. Keep the two copies identical.
