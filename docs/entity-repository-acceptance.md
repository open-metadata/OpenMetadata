# Reproducing the entity repository acceptance gates

The [design](entity-repository-composition.md#verification-and-acceptance) requires
both a passing regression/coverage gate and repeatable API performance evidence.
The [status](entity-repository-status.md) and
[performance results](entity-repository-performance.md) identify completed runs.
An incomplete matrix, failed suite, or unstable baseline keeps acceptance open.

## Whole-class coverage

`scripts/jacoco_class_coverage.py` generates an unfiltered JaCoCo report from
compiled production artifacts and completed test executions. It requires 90%
line coverage for every executable class in changed production sources,
including anonymous and nested classes. Well-covered classes cannot compensate
for an under-covered class. Interfaces without executable lines are recorded
without assigning an artificial coverage percentage.

The scope includes working-tree and untracked production Java changes from the
branch's merge-base with the target branch. Deleted sources are excluded. The
command rejects a manifest that omits a changed module. For this refactor the
native scope includes `openmetadata-service` and `openmetadata-mcp`; the companion
scope includes `collate-service` and the support, query-runner, and reverse-metadata
plugins.

Capture JaCoCo execution data and the process exit status for each unit or
integration suite. Run the configured isolated and parallel Maven executions
separately; overriding their selection with `-Dit.test=*IT` defeats the exclusions
that protect server-wide state. Record skips and configuration assumptions in the
retained test reports. A zero process exit is necessary, but does not establish
that optional external-server scenarios actually ran.

Create a manifest with the following shape. Paths are relative to the manifest
file, or absolute; use actual SHA-256 values for every input. Add every changed
module's production JAR and source root, and every completed execution being
combined. Preserve the original input files after computing their hashes.

```json
{
  "repository": "../..",
  "base_ref": "origin/main",
  "source_roots": [
    "openmetadata-service/src/main/java",
    "openmetadata-mcp/src/main/java"
  ],
  "source_sha256": {
    "<changed production source path>": "<SHA-256 captured when building the artifacts>"
  },
  "artifacts": [
    {"path": "service.jar", "sha256": "<service SHA-256>"},
    {"path": "mcp.jar", "sha256": "<MCP SHA-256>"}
  ],
  "executions": [
    {
      "name": "unit",
      "data": {"path": "unit.exec", "sha256": "<execution SHA-256>"},
      "result": {"path": "unit.exit", "sha256": "<exit-file SHA-256>"}
    }
  ],
  "jacoco_cli": {
    "path": "org.jacoco.cli-0.8.13-nodeps.jar",
    "sha256": "<JaCoCo CLI SHA-256>"
  }
}
```

After activating the Python environment, run:

```bash
python scripts/jacoco_class_coverage.py \
  --manifest path/to/coverage-inputs.json \
  --output path/to/new-coverage-report \
  --java "$JAVA_HOME/bin/java"
```

The output directory must be new. It contains `jacoco.xml`, `jacoco.log`,
`classes.csv`, and `gate.json`, including input/report hashes, source hashes, git
revisions, missing sources, under-covered classes, and failed executions.

| Exit | Meaning |
| --- | --- |
| 0 | Every changed executable class reaches 90%; all supplied suites passed |
| 1 | Class coverage, source completeness, or test execution failed the gate |
| 2 | Invalid/incomplete inputs, omitted modules, changed hashes, or JaCoCo error |

JaCoCo class-identity warnings invalidate the report. Failed suites may be
included to diagnose gaps, but make the overall gate fail even if their executed
lines bring coverage above 90%. The checker itself has parser/scope regressions
in `scripts/tests/test_jacoco_class_coverage.py`.

Capture `source_sha256` at artifact creation for every changed production source.
The checker compares those hashes with the working tree before reading coverage;
editing a source invalidates the earlier build's evidence. Artifact producers must
bind this source snapshot to the build, rather than refreshing hashes to make an
old artifact match new sources.

## Allocation measurement

`EntityBenchmarkControl` exposes a private loopback endpoint alongside a benchmark
server. `EntityBenchmarkControlClient` reads its endpoint/token file, executes a
control operation, and writes the response to a file. Tokens remain in the private
file. The client must run in the server's network namespace when containerized.

```bash
java -cp "$BENCHMARK_CLASSPATH" \
  org.openmetadata.it.perf.EntityBenchmarkControlClient \
  manifest.json.control.json environment environment.json
```

The environment response identifies Java runtime/vendor, OS, architecture,
available processors, and the Testcontainers session. Use that session's labels
to identify the benchmark's infrastructure containers before assigning CPU sets.

Enable per-workload allocation observations on the separate HTTP load client:

```bash
java \
  -DentityBenchmark.control=manifest.json.control.json \
  -DentityBenchmark.reset=none \
  -DentityBenchmark.allocations=true \
  -DentityBenchmark.scheduling=single-client \
  -cp "$BENCHMARK_CLASSPATH" \
  org.openmetadata.it.perf.EntityApiBenchmark \
  manifest.json allocations.csv 5000 1000 1000 'get.columns.100'
```

Each workload writes an `.allocation.json` file next to its latency/request
outputs. The allocation window starts after fixture preparation and successful
warmup, and ends after the measured requests complete. It records both server
heap/GC snapshots, operation count, elapsed time, allocation delta, and bytes per
operation. An unavailable or decreasing counter rejects the measurement.

The counter covers allocations across the server JVM, including completed virtual
threads. It is approximate and includes background work and control-request
overhead; it does not attribute exact bytes to an individual API handler. Compare
matching workload windows and retain GC/background observations. Protocol tests
exercise warmup exclusion, unsupported counters, counter resets, and allocations
on completed virtual threads.

## Latency and load acceptance

Freeze baseline/candidate runtime dependencies and benchmark controls/client
before starting either server. Keep API fixtures, Java build, heap/GC, durable
database settings, search backend, and cache configuration identical. Record the
actual runtime and CPU configuration. Exclude builds, test suites, SQL probes,
and allocation profiling from latency comparisons.

First compare the original artifact against itself on the intended runner. CPU
affinity alone does not demonstrate repeatability. Retain every round and the
ordered request traces; do not discard slow rounds to obtain a passing baseline.
Proceed to five alternating baseline/candidate pairs only after this calibration.

The required matrix includes API families and widths, both databases, disabled,
warm, cold, L1-cold, unavailable and recovered cache states, baseline capacity,
equal offered loads at 25%/50%/75%, and overload/recovery. Async acknowledgement
and observed completion are distinct measurements. The existing acknowledged
per-request cold reset serializes requests: its results cannot establish
concurrent cold-cache capacity. A concurrent cold-start or disjoint working-set
experiment must record that different cache lifecycle explicitly. The client now
supports `-DentityBenchmark.coldStart=cold` or `l1-cold` together with
`-DentityBenchmark.reset=none`. This resets once after warmup, records its
acknowledgement in `.cache.json`, and preserves concurrent measured arrivals.
`-DentityBenchmark.warmupRate=...` permits warmup below the subsequent overload rate.

## Portable paired runs

`scripts/entity_api_benchmark.py` drives the version-neutral Java client against
two already provisioned benchmark servers. The launcher can be `java`, or a
command prefix such as `taskset ... java` or `docker run ... java`; it is passed as
an argument array, without a shell. Each client must reach its server's private
loopback control listener. Use the same frozen control/client classes for both
servers, ahead of their revision-specific test/runtime classpaths. The fixture
server itself must use classes compiled against that server revision.

Start each server with its own manifest path and durable database configuration:

```bash
java @baseline-server.args \
  org.openmetadata.it.perf.EntityBenchmarkControl /runs/baseline/manifest.json
```

The argument file contains the frozen classpath, Java/heap/GC options,
`-DdbDurable=true`, and matching `databaseType`, `databaseImage`, `searchType`,
`searchImage`, `cacheProvider`, and `redisImage` properties. Run the second server
with a separate argument file, database/search/cache containers, and manifest.
Record actual CPU affinity, backend settings and fixture preparation in the
configuration's `runner` object. Freeze all runtime artifacts, controls, client
classes and argument files; retain their hashes. Do not point a benchmark at an
existing catalog.

An older 102-workload manifest can be extended with the same 36 column-page
requests used by the current generator. This preserves its entity IDs, FQNs,
tokens and existing requests, and writes a new private file:

```bash
java @client.args org.openmetadata.it.perf.EntityBenchmarkManifestUpgrade \
  /runs/baseline/manifest.json /runs/baseline/manifest-with-pages.json
```

Use the configuration shape below, replacing every placeholder with an actual
path/hash. File references can be relative to the configuration file; paths in
the Java argument arrays must resolve where that command runs. `client_files`
must cover the client/control classes, runtime dependencies and argument files.
Container launchers must mount argument, control, manifest and output files at
the same absolute paths visible to the Python driver.
For calibration, both `artifact` entries identify the same baseline build.

```json
{
  "kind": "calibration",
  "samples": 5000,
  "warmup": 1000,
  "conditioning": 20000,
  "case": {
    "database": "mysql",
    "cache": "warm",
    "workload": "get.columns.100",
    "phase": "latency",
    "scheduling": "single-client",
    "offered_rps": 1000
  },
  "runner": {
    "java_image": "<immutable image digest or distribution hash>",
    "heap": "1 GiB, G1",
    "sut_cpus": "2-5",
    "client_cpus": "6,7",
    "backend_cpus": "0,1,8,9",
    "database": "<image digest, durability and pool settings>",
    "search": "<image digest and settings>",
    "fixtures": "<fixture snapshot/generator hash and restore procedure>"
  },
  "client_files": [{"path": "client.args", "sha256": "<hash>"}],
  "servers": {
    "baseline": {
      "java": ["java", "@/runs/client.args"],
      "artifact": {"path": "baseline.jar", "sha256": "<hash>"},
      "manifest": {"path": "baseline/manifest.json", "sha256": "<hash>"},
      "control": {"path": "baseline/manifest.json.control.json", "sha256": "<hash>"}
    },
    "candidate": {
      "java": ["java", "@/runs/client.args"],
      "artifact": {"path": "baseline.jar", "sha256": "<same baseline hash>"},
      "manifest": {"path": "second-baseline/manifest.json", "sha256": "<hash>"},
      "control": {"path": "second-baseline/manifest.json.control.json", "sha256": "<hash>"}
    }
  }
}
```

After activating the Python environment:

```bash
python scripts/entity_api_benchmark.py --config calibration.json --output runs/calibration
python scripts/entity_api_acceptance.py \
  --manifest runs/calibration/measurements.json --output runs/calibration/rechecked.json
```

Every experiment gets a new directory with its plan, observed environment/cache
states, conditioning logs, ten alternating measured runs, ordered request traces,
exit statuses, hashed input references and result. The runner rejects failed
warmup, clock discontinuities, runtime mismatches and instrumentation. It pauses
only the Redis containers controlled by these servers and attempts to resume each
paused container on failure. Workload fixture setup remains outside the measurement.

For a candidate comparison, set `kind` to `comparison`, replace the second server
with the candidate artifact, and add `calibration` as a path/hash reference to the
matching successful calibration's `measurements.json`. An unsuccessful calibration
stops candidate load generation. A different case, artifact, client or runner
requires matching calibration evidence.

The analyzer recomputes p50/p95/p99 from every ordered request sample. It requires
five complete pairs and at least 2,000 measured requests per side per pair; the
example uses 5,000. Baseline calibration uses predeclared spread bounds of
1.10/1.15/1.20 for p50/p95/p99 and directional bias bounds of 1.03/1.05/1.10.
These assess measurement repeatability; they are not candidate slowdown allowances.
A slowdown at a percentile in all five pairs rejects the candidate, regardless
of its size. A throughput reduction in all pairs or worse aggregate overload
errors also rejects it. Instability on either side is inconclusive. Passing this
criterion means no repeatable regression was detected under these observations;
it does not prove that every possible latency difference is zero.

## Capacity, load and allocation

After the single-client baseline calibration passes, use `kind: "capacity"` with
the same case and a `calibration` reference, plus an increasing `rates` array and
`max_submission_delay_ms`. For example, `[100, 200, 400, 800]` and `5` milliseconds.
The driver runs five observations at each offered rate. Capacity is the highest
rate that delivers at least 99% of offered throughput, zero errors, and p99
submission delay within that bound in every observation. A higher rate must fail
those criteria; otherwise the ramp is inconclusive. This is capacity under the
configured client concurrency limit (at most 32), not an unconstrained server maximum.

For `load25`, `load50`, `load75`, `overload` and `recovery` cases, use `open-loop`,
the proven `baseline_capacity_rps`, a `capacity` reference to the capacity run's
`measurements.json`, and `offered_rps` at respectively 25%, 50%, 75%, 125% or 50%
of that rate. Calibrate each case before comparing the candidate. Recovery runs
retain a separate overload observation immediately before every measured recovery
window, and evaluate both. Cold load cases require `cache_lifecycle: "cold-start"`;
they cannot substitute for per-request cold single-client measurements.

An `allocation` phase uses the same paired protocol and compares bytes per operation;
its latency CSV is not used for latency acceptance. The runner captures cache
availability before and after every window and waits for real unavailable and
recovered provider states when those cache cases are selected.

To check matrix completeness, give the analyzer a manifest with `kind: "matrix"`
and an `experiments` array of path/hash references to comparison `measurements.json`
files. It re-evaluates the inputs and rejects mixed artifact/client revisions.
Missing, unstable and regressing cases keep the matrix open. The expected catalogue
also names the design's unimplemented benchmark scenarios: consolidation,
metadata-override bulk batches, hierarchy delete/restore, concurrent reads during
writes, and small/large keyset/offset list/history pages. Their absence cannot be
hidden by running the existing 138 workloads alone.

The paired-run command returns 0 only for a passing experiment, 1 for a measured
regression/inconclusive result, and 2 for rejected inputs or execution. The analyzer
also returns 1 for an incomplete matrix. These commands are opt-in; the current
CI workflow definitions do not invoke the new gates.

SQL reductions, passing protocol tests, allocation reductions, and a passing
coverage checker do not substitute for the completed latency/load matrix.
