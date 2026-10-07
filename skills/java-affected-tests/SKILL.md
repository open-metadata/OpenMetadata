---
name: java-affected-tests
description: Use before opening or updating an OpenMetadata PR that changes Java, a JSON schema, an index mapping, a SQL migration, seed data or a pom — PR CI no longer runs the Java integration tests (they run only in the merge queue) and the JavaUIIT/search-it suites run only nightly, so this selects the unit tests and integration tests the diff can break, runs them in the lane and engine CI uses, and records the results in the PR body. Also use when asked which Java tests to run for a change, or how to run one integration test.
user-invocable: true
argument-hint: "[--base <ref>] [--add-it A,B] [--add-unit C] [--keep-going] [--update-pr]"
---

# Java tests to run before a PR

| Suite | PR checks | Merge queue | Nightly | You, before the PR |
| --- | --- | --- | --- | --- |
| Unit tests | full | full | — | impacted classes |
| Integration tests (`openmetadata-integration-tests`) | skipped | full, every lane and engine | — | impacted classes |
| search-it (`tests/search/*IT`) | — | — | openmetadata-nightly | impacted classes |
| JavaUIIT (`*UIIT`), scale-it | — | — | openmetadata-nightly | reported, not run |

The merge queue is the first CI run of the ITs. An IT failure there ejects the PR and
re-tests every PR queued behind it. Search-indexing changes have no pre-merge CI at all, so
your run is their only check before merge. Run what the planner selects, every time.

## 1. Preconditions

- `git fetch origin main`, so the diff base is current. The planner diffs `origin/main...HEAD`
  plus uncommitted and untracked files.
- Docker running, with no other Testcontainers stack up:
  `docker ps --filter label=org.testcontainers=true`. Another checkout's ITs plus yours rarely
  fit in Docker's memory. Wait for them; don't stop them.
- JDK 21. No `mvn install` needed: every command builds the modules under test with `-am`.

## 2. Plan

```bash
make java_affected                # what runs, why, and the exact commands
```

| Planner output | What to do |
| --- | --- |
| `No Java tests are impacted` | Put the NOT NEEDED block in the PR (`make java_affected_run` writes it) |
| `[unit] … FULL suite` | Expected for poms and widely used classes |
| `[integration] Class lane engine <- reason` | Run them all; the reason names the bucket, entity or changed file |
| `Impacted, but not run locally` | List them in the PR with where they run (nightly, external cluster); don't run |
| `Changed classes no unit test references` | Add a unit test (see `test-enforcement`), or say in the PR why none applies |
| `Impact-map gaps` | Add a mapping for the file to `.github/java-tests/impact-map.json` in this PR, then re-plan |

The map is the floor. Add tests it can't know about: an endpoint you changed that another
area's IT exercises, or a field the search document, lineage or alerts read. Use
`ARGS="--add-it LineageResourceIT --add-unit FooTest"` so the run records them. If the link is
durable, add a mapping instead, so the next change gets it too. Never drop a selected test.

## 3. Run and record

```bash
make java_affected_run                         # unit step first, then one step per lane and engine
make java_affected_run ARGS="--update-pr"      # once the PR exists: upsert the block in its body
```

Measured on 2026-10-07: one unit class took 0.9 min. One small IT took 2.0 min, almost all of
it the `-am` reactor build plus the MySQL + Elasticsearch Testcontainers bootstrap, which every
IT step pays. Big classes add their own time; CI's parallel lane runs 334 classes in
46 min on four workers.

- The run stops at the first failing step. `--keep-going` runs the rest.
- A step passes only with exit 0, no failures, more than zero tests, and a report for every
  selected class. A green `BUILD SUCCESS` with zero tests is a failure.
- Results: `target/java-tests/local-pr-results.md`. Before the PR exists, paste it between the
  `local-java-test-results` markers under "Backend integration tests". Never edit the block.

## 4. When something fails

1. Re-run the failing class alone (section 5), then the failing method: `-Dit.test='Class#method'`.
2. Fails on your branch only → it's your change. Fix it.
3. Also fails on a clean `origin/main` worktree with the same command → pre-existing. Link or
   open an issue and say so in the PR. Don't call the run passed.
4. Passes on retry → a flake. Name the test in the PR, with how often it failed.

## 5. Running one IT by hand

Copy the exact line from `make java_affected` when you can. The general shape:

```bash
mvn -B verify -pl :openmetadata-integration-tests -am -Dspring-boot.repackage.skip=true \
  -Pmysql-elasticsearch -DintegrationTests.lane=parallel -Dit.test=TableResourceIT \
  -Dfailsafe.failIfNoSpecifiedTests=false -Dtest=NoUnitTestsInThisRun -Dsurefire.failIfNoSpecifiedTests=false
```

- Lane: `parallel` by default. Classes listed in the IT pom's `integrationTests.globalStateTests`,
  `multiNodeTests` and `retryQueueTests` use `global-state`; `rdfTests` use `rdf`.
  `tests/search/*IT` use `-Psearch-it -DdatabaseType=postgres -DsearchType=opensearch` instead
  of an engine profile.
- Engine: `-Pmysql-elasticsearch`, or `-Ppostgres-opensearch` for Postgres SQL and OpenSearch
  code. Without any `-P<engine>`, a lane run executes zero tests and still prints BUILD SUCCESS.
- Without a lane, `-Dit.test` runs the class twice, once in each failsafe execution.
- `mvn test -pl openmetadata-integration-tests -Dtest=…IT` tests the `openmetadata-service` jar
  in `~/.m2`, which another checkout may have overwritten. Use `-am` as above.
- `mvn test … -am` cannot compile the service. The relocated search clients only exist after
  `package`, which is why unit steps run `mvn -B package -pl <module> -am -Dtest=…`.
- Check the evidence: a `Tests run: N` line with N > 0, and
  `openmetadata-integration-tests/target/failsafe-reports/TEST-*.xml` for your class.

JavaUIIT runs with `-Pui-it` and needs the server image built from `openmetadata-dist`; scale-it
needs a 100k-entity cohort. Both are nightly suites. Run them by hand only when you are changing
them.

## 6. After you open the PR

- PR checks: Java unit tests. `maven-collate-ci` builds Collate and runs its unit tests against
  your change.
- Merge queue: the full IT suite on MySQL+ES and PostgreSQL+OS (both required), PostgreSQL+ES+Redis
  (informational), and the Collate ITs.
- Full IT suite on a branch before queueing, for a large refactor:
  `gh workflow run "Integration Tests - MySQL + Elasticsearch" --ref <branch>`.

How selection works, and how to extend the map: `.github/java-tests/README.md`.
