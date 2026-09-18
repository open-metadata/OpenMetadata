# CLI E2E v2

Real source → `metadata` subprocess → real OpenMetadata sink/server → persisted SDK observations.
MySQL is the reference connector. Dashboard authoring is design-validated only; this suite does not ship live Metabase coverage.

## Run

From the repository root, activate a development virtual environment with the ingestion package, MySQL connector dependencies, pytest, and testcontainers installed. Docker must be available for the disposable MySQL source. Supply a running, compatible OpenMetadata server separately; the suite does not provision or stop that server.

```bash
source env/bin/activate
export PYTHONPATH=ingestion/src
export OM_SERVER_URL=http://localhost:8585/api
python -m pytest ingestion/tests/cli_e2e_v2/mysql --e2e-contract-check -v
```

Use `OM_JWT_TOKEN` for an existing token. Without it, `server.py` authenticates with `OM_ADMIN_EMAIL` / `OM_ADMIN_PASSWORD` (defaults: `admin@open-metadata.org` / `admin`) and obtains the ingestion-bot token. Missing credentials, unreachable services, and failed provisioning are errors, not skips.

The MySQL fixture owns a disposable container, ingestion account, and unique per-test schemas. Each test also owns a unique OM service. Cleanup runs after setup or call failures; cleanup failures remain teardown errors alongside the original failure. Never point these mutating fixtures at a shared source or reset somebody else's schema.

Focused runs do not require completeness checking:

```bash
python -m pytest ingestion/tests/cli_e2e_v2/mysql/test_metadata.py::test_mark_deleted_tables_on_reingest -v
```

Framework meta-tests require no Docker, server credentials, or network access:

```bash
env -u OM_JWT_TOKEN OM_SERVER_URL=http://127.0.0.1:1/api \
  python -m pytest ingestion/tests/cli_e2e_v2/meta -q
```

The shared Python CI workflow runs this offline suite once, on Python 3.10, when E2E code,
ingestion dependency/test configuration, generated-model schemas, or the relevant CI wiring changes.
It reuses the unit-test environment and does not run live connectors. Unrelated changes skip this step;
manual Python workflow runs include it. The live connector workflow remains manually triggered.

## Boundaries

```text
cli_e2e_v2/
  runtime/             subprocess, typed status, polling, three-field cases
  features/database/   generated pipeline options, catalog/profile/sample/lineage checks
  contracts/           coverage-inventory schema/loader and optional shared workflow test
  mysql/               owned source, context, expectations, checks, named feature tests
  meta/                offline runtime and framework behavior tests
  server.py            explicit OM configuration and authentication
  conftest.py          shared fixtures and collection validation
```

MySQL tests explicitly call `cli.run(mysql.invocation(options))`, then `expect.poll(query).satisfies(check)`. The `mysql` context binds source identity, configuration, and fresh queries; it does not run ingestion, own cleanup, or cache observations. Fixtures provision the source and service, while tests show the actions and assertions in execution order. `WorkflowCase(invocation, persisted, check)` remains an optional shared helper, not a required authoring pattern.

Only checker `AssertionError` mismatches retry. SDK, transport, parsing, and checker programming errors fail immediately. Every polling assertion gets a fresh budget; increasing that budget cannot cancel a blocking SDK read or repair an incorrect expectation.

`CliRunner(work_dir: Path, *, command=("metadata",))` writes an isolated temporary `config.yaml` and requires the CLI to produce `status.json` for each invocation. It returns `RunResult(exit_code, status)` only after validating the expected exit code, typed status success, and exact total record-error count independently. Normal runs require zero errors, even when the workflow's success threshold accepts partial failures. Negative cases must explicitly set `expected_errors` as well as the expected exit and success. Missing or malformed status is a failure, even with exit code zero. CLI timeouts fail the test; on POSIX, process-group cleanup also terminates child processes after completion or cancellation.

Read [CONNECTORS.md](CONNECTORS.md) for source ownership, complete SQL case wiring, custom scenarios, and an illustrative dashboard extension. New connectors do not need a runtime subclass, mutable fluent assertion object, or enforcer hierarchy.

The MySQL scenarios are grouped into `test_metadata.py`, `test_profiles.py`, and `test_samples.py`. `test_fixture_safety.py` checks isolation, least privilege, and failure-path cleanup against real MySQL without an OpenMetadata server. These safeguards are distinct from feature assertions: successful ingestion cannot prove that teardown removed a container. Run them independently with:

```bash
python -m pytest ingestion/tests/cli_e2e_v2/mysql/test_fixture_safety.py -v
```

## Coverage and known failures

`--e2e-contract-check` loads `INVENTORY` from each selected connector's `inventory.py`. There is no central connector registry or default database inventory; a missing, empty, or incorrectly identified inventory fails collection. Each supported required ID needs exactly one collected `e2e_contract` mark. Unknown, duplicate, missing, skipped, or xfailed cases fail collection. Runtime skips and xfails (including non-strict XPASS) also fail required contracts during setup, execution, or teardown. Unsupported capabilities require a reviewed reason and cannot contradict a declared generated support flag. A connector's inventory records scope; it is not a runtime plugin registry.

Completeness mode intentionally rejects node IDs, files, and selection options (`-k`, `-m`, `--deselect`, added `--ignore`, `--ignore-glob`, and `--lf`). Use it for full-suite runs, not local selection. Passing collection proves inventory completeness, not connector correctness.

The MySQL native sample checks deliberately retain strict YEAR/BIT/null expectations. Row-count and column-freshness scenarios remain independently executable while `useStatistics` behavior is investigated. These are genuine red assertions when observed values differ: do not add skips, xfails, allowlists, or exit-code rewriting to report a green framework run.

The separate `sample.values.replacement` scenario samples the same table before and after a source mutation,
checking integer and null values independently of the strict native-type scenarios.

## Debugging and reporting

The CLI inherits stdout and stderr. Pytest's default file-descriptor capture includes subprocess output and displays it with setup, call, or teardown failures. CI uses that ordinary pytest output; there is no custom publisher, report sanitizer, or assertion ledger.

- Default capture keeps successful runs quiet and shows captured output for failures.
- Add `-rP` to show captured output from passing tests, or `-rA` for all summary categories, including passing output. Both increase CI log volume.
- Add `-s` for live stdout/stderr in a single-process run. This disables capture, so output is immediate and is not repeated in captured failure sections. With pytest-xdist, keep default file-descriptor capture so worker subprocess stdout is retained.

For a CLI failure, inspect the reported exit/status mismatch and captured subprocess output. For a persisted-state failure, the polling assertion reports the query label, attempts, elapsed time, and final mismatch. A successful CLI exit does not establish that the expected entities, values, or relationships were persisted.

Temporary `config.yaml` and `status.json` files are test input and status-validation data, not a publication contract. They may contain credentials or sensitive failure details; do not dump them or upload the whole pytest temporary directory. Keep credential-bearing fixture fields out of object representations with `repr=False`, and avoid logging workflow configs, connection strings, passwords, or tokens.

Use the CI provider's native secret masks for actual configured and generated credentials before any command can print them. Masking is not a detector for unknown secrets. Test product redaction with synthetic values in focused tests; this E2E harness does not scrub output to conceal a product redaction defect.

CI log masking does not sanitize JUnit files. Avoid `--showlocals` with real credentials, and review any report-upload policy separately.
