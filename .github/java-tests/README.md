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

`.github/scripts/plan_local_java_tests.py` diffs the branch against `origin/main` (`--base` to
change it; uncommitted and untracked files count) and selects tests in layers. Each layer only
adds tests:

1. **Changed tests** run as they are: a changed `*Test` in a unit module, a changed `*IT`/`*Test`
   in `openmetadata-integration-tests`.
2. **Unit tests by reference.** For a changed production class `X`: `XTest`, plus every unit test
   in `unitTestModules` that mentions `X` as a word. A changed schema file adds the tests that
   use its generated class (`createTable.json` → `CreateTable`). When more than
   `unitTestReferenceCap` tests in one module use `X`, that module's full suite runs instead.
3. **Entity convention.** `XRepository`, `XResource`, `XMapper`, `XIndex`, the entity schema
   `x.json`, the create schema `createX.json` and `x_index_mapping.json` select every IT whose
   name starts with `X` at a CamelCase boundary: `Table` selects `TableResourceIT` and
   `TableCertificationPropagationIT`, not `TablesFooIT`.
4. **Buckets.** `mappings` in `impact-map.json` maps source globs to IT patterns by architecture
   area: search (core, indexing, mappings, query, engines, vector), lineage, events/alerts,
   security, governance, data quality, apps, RDF, migrations, and so on.
5. **References from the test side.** A change to an SDK class or an IT harness class selects
   the ITs that use it, directly or through other harness classes and `neverRun` base classes
   (`AuthBackend` → `TokenRefresher` → `SdkClients` → every IT). Past
   `integrationTestReferenceCap` users, the smoke set runs instead.
6. **Smoke.** `sharedInfrastructure` (poms, shaded deps, the SDK, `BaseEntityIT`) and any
   production file or IT harness class no rule reaches add the `smoke` set. Unmapped files are
   listed as **impact-map gaps**; close a gap by adding a mapping in the same PR rather than
   living with smoke.

Each selected IT runs in the failsafe execution CI uses for it, read from
`openmetadata-integration-tests/pom.xml`. Classes in `integrationTests.globalStateTests`,
`multiNodeTests` and `retryQueueTests` run in the isolated fork. `rdfTests` run in the rdf lane,
which starts Fuseki. `tests/search/*IT` run under `-Psearch-it`. Everything else runs in the
parallel lane. Every command names its engine profile (`-Pmysql-elasticsearch` by default),
because a lane run without one executes zero tests and still prints `BUILD SUCCESS`.

Engines: a bucket's `engines` and the `engineRules` add engines. Postgres SQL runs on
`postgres-opensearch`, DAO changes run on both databases, OpenSearch client code runs on
`postgres-opensearch`, and cache code also runs with Redis (`cache-tests`). A suite profile
(`maven.suites`, here only `search-it`) picks its backend from `-DdatabaseType`/`-DsearchType`
through its `engines` table, and defaults to PostgreSQL + OpenSearch, as the former PR job did.

Every command uses `-am`, so the reactor builds the modules under test from this checkout instead
of resolving them from `~/.m2`. Another checkout can overwrite those jars mid-run, and a stale jar
silently tests old code. Unit steps run `package` because the relocated `es.*`/`os.*` search
clients only exist once `openmetadata-shaded-deps` is packaged. IT steps pass a `-Dtest` filter
that matches nothing, so `-am` doesn't also run every upstream unit suite.

`--run` clears the report directories before each step and fails a step that ran zero tests or
left a selected class without a report. It refuses to start the ITs while another Testcontainers
stack is running (`--allow-concurrent` overrides), because two stacks rarely fit in Docker's
memory.

## Changing the map

- A new IT must sit in at least one bucket: `make java_affected ARGS=--check-map` and the
  `java-impact-map` harness check report any that don't, plus patterns that match nothing and
  engines the IT pom lacks.
- Test patterns without a `/` match the class's simple name (`Search*IT`). Patterns with a `/`
  match its path under `openmetadata-integration-tests/src/test/java`. Source and test globs use
  `fnmatch`, where `*` crosses directories.
- `notRunLocally` and `neverRun` are applied before lanes, so such a class is reported, never run.
- Validate with `python3 -m pytest .github/scripts/test_plan_local_java_tests.py`.

The script holds no repo-specific knowledge beyond these defaults. `maven.lanes` (membership read
from `pomProperties` or a failsafe execution's `pomExecutionIncludes`), `maven.suites`,
`maven.unitPhase` and `prHeading` let openmetadata-collate run the same file with its own map.
Keep the two copies identical.
