# Authoring connector E2Es

Own the source in fixtures, run workflows explicitly in named pytest tests, and assert persisted behavior using ordinary functions. `mysql/` is the runnable SQL reference. The dashboard example below is illustrative, not shipped Metabase coverage.

## Ownership and layout

```text
<connector>/
  baseline.py          independently authored source schema and seeds
  source.py            provision, validate, mutate, and tear down owned resources
  connector.py         build WorkflowInvocation values; bind repeated context locally
  expected.py          independently authored expected OM entities and values
  checks.py            pure connector-specific persisted-state checks
  inventory.py         reviewed contract IDs and generated capability declarations
  conftest.py          resource ownership, service_entity, connector context fixture
  test_metadata.py     named metadata and mutation scenarios
  test_profiles.py     named profile scenarios, where supported
  test_samples.py      named sample scenarios, where supported
  test_fixture_safety.py  focused infrastructure safeguards, where needed
```

This is a guide, not a required file count. Small connectors can combine declarations. Add the standard full ingestion CCL header to every new Python file, including package initializers.

The source fixture must allocate a unique namespace, register cleanup before fallible setup, create the declared source data, and remove only its own resources. A failed test must not contaminate the next test. Feature tests assert independently expected persisted values; a second exhaustive seed audit is not required. Check source preconditions when they prevent a false positive, such as proving both schemas are populated and readable before testing exclusion. Mark credential-bearing dataclass fields `repr=False`; do not dump workflow configs, connection strings, passwords, or tokens. Register actual configured/generated secrets with the CI provider's native masking facility before commands can expose them. Do not silently skip missing setup or accept an unmanaged source for mutation tests.

The root `service_name` fixture owns one unique OM service. A connector supplies `service_entity` (`DatabaseService` for SQL); cleanup includes soft-deleted services in its lookup and recursively hard-deletes the owned service. Do not maintain a second service registry or swallow cleanup exceptions. The OM server itself is external and remains running.

For SQL sources, `SqlSourceBaseline` holds SQLAlchemy `metadata`, table `seeds`, and an ordered `ddl` list for views, procedures, or other connector-owned objects. Setup creates tables, inserts seeds, then executes each DDL statement in list order. Quote identifiers with the source dialect; keep creation dependencies in that order. Expected views and procedures remain independently declared in `expected.py`, not inferred from creation SQL.

## A complete SQL case

The following is a complete test module when placed under `mysql/`: the `mysql` fixture composes the owned source, service identity, server configuration, and SDK. Use this as a replacement/example, not an additional duplicate `catalog.metadata` contract in the same suite.

```python
import pytest

from ingestion.tests.cli_e2e_v2.features.database.catalog.differ import catalog_matches
from ingestion.tests.cli_e2e_v2.features.database.pipelines import MetadataPipeline
from ingestion.tests.cli_e2e_v2.mysql.expected import mysql_expected
from ingestion.tests.cli_e2e_v2.runtime import expect


@pytest.mark.e2e_contract("catalog.metadata")
def test_catalog(cli, mysql):
    cli.run(mysql.invocation(
        MetadataPipeline(includeDDL=True, includeStoredProcedures=True)
    ))
    expected = mysql_expected(mysql.service_name, schema=mysql.source.schema)
    expect.poll(mysql.catalog_query()).satisfies(
        catalog_matches(expected)
    )
```

The three operations are deliberately independent:

- `mysql.invocation(options)`: builds the CLI subcommand and entire workflow config, including sink and server settings. It does not execute it. Database helpers serialize generated pipeline models and resolve command, source suffix, and processor together through `pipeline_spec(options)`; the runtime does not infer connector family.
- `mysql.catalog_query()`: binds a labeled zero-argument read of actual OM state. Each polling attempt reads fresh data. Inventory queries must consume every page. Do not filter observations down to the expected result.
- `catalog_matches(expected)`: validates complete inventory and declared fields in one snapshot, with exact descriptions and optional `ExpectedTable.table_type` checks. Raise `AssertionError` for a mismatching observation, not for transport/authentication failures. Validate bad checker options before polling.

The connector context is a local convenience, not a required interface or base class. Keep provisioning and cleanup in fixtures, mutations on the owned source, and execution in the test. Use existing feature helpers directly for less common operations rather than wrapping every SDK method. A new connector needs no shared-core changes to follow this pattern.

The shared `cli` fixture supplies `CliRunner(work_dir: Path, *, command=("metadata",))`. Each invocation uses temporary `config.yaml` and `status.json` files and returns only `RunResult(exit_code, status)` after strict exit/status validation and an exact record-error count check (zero by default). Subprocess stdout/stderr flow into ordinary pytest file-descriptor capture. Persisted checks and the final polling mismatch remain ordinary assertions; they do not need a diagnostics recorder.

Expected native types, values, inventory, and relationships come from authored seed declarations, not the connector's parsers/type maps or current OM output. `mysql_expected` uses the E2E declaration/type-map layer, independent of production ingestion parsing. Catalog equality alone does not prove profile values, samples, foreign keys, lineage, or dashboard memberships.

Declare views with `ExpectedTable(..., table_type=TableType.View)` in the expected catalog; the shared checker does not infer type from a fixture name. Optional fields set to `None` are not asserted. Catalog checks always reject unexpected entities and columns; use a targeted entity query when a feature needs only one prerequisite.

## Feature checks and custom tests

Write named pytest tests for both single-action and multi-action scenarios: call `cli.run(invocation)`, then `expect.poll(query).satisfies(check)`. There is no shared imported test, scenario DSL, or global connector auto-discovery.

This custom MySQL module checks exact row count after metadata and profiling:

```python
from ingestion.tests.cli_e2e_v2.features.database.entities import entity_exists
from ingestion.tests.cli_e2e_v2.features.database.pipelines import MetadataPipeline, ProfilerPipeline
from ingestion.tests.cli_e2e_v2.features.database.profiles import table_has_row_count
from ingestion.tests.cli_e2e_v2.runtime import expect


def test_customer_count(cli, mysql):
    cli.run(mysql.invocation(MetadataPipeline()))
    expect.poll(mysql.table_query("customers")).satisfies(entity_exists)
    cli.run(mysql.invocation(ProfilerPipeline(useStatistics=False)))
    expect.poll(mysql.profile_query("customers")).satisfies(table_has_row_count(5))
```

`useStatistics=False` is an input, not permission to relax expected row count. This example can expose the same product behavior as the strict reference tests.

Other reusable checks live in `features/database/entities.py`, `samples.py`, `profiles.py`, `lineage.py`, and `catalog/`. Compose related checks inside one checker when they must hold on the same observation. Keep independent feature scenarios in separate test items so one product failure cannot mask another.

Metadata prerequisites check only the entities required by the feature. Keep whole-catalog equality in its own test so an unrelated catalog mismatch does not prevent a profiler or sample scenario from executing.

For multi-step scenarios, follow `test_mark_deleted_tables_on_reingest` and `test_repeat_ingest_preserves_ids_and_updates_metadata` in `mysql/test_metadata.py`:

1. Ingest the fixture's source and assert initial persisted entities; retain UUIDs.
2. Mutate only the owned source; verify the mutation directly against that source.
3. Run the CLI again and poll fresh persisted observations.
4. Assert the intended update/deletion, stable UUIDs, and an unaffected retained control.

For filter scenarios, keep filter inputs and expected entity sets together in each parameter. Prove the baseline includes both the retained and excluded objects, use a fresh OM service for filtered ingestion, and compare complete inventory. A successful lookup of the retained table does not prove exclusion.

## Expected failures

An expected failure must declare the exact process exit, status success, and record-error count, then inspect the specific failure and surviving entities:

```python
result = cli.run(invocation, expected_exit=1, expected_success=False, expected_errors=1)
assert result.status.total_errors == 1
assert len(result.status.all_failures) == 1
assert result.status.all_failures[0]["name"] == "_broken_view"
```

The reference containment test creates an invalid view in its owned schema and sets `workflowConfig.successThreshold=100` and `raiseOnError=True`. Ten successful records out of eleven exceed the default 90% threshold; requiring 100% makes that single failure determine the exit. Independently, the runner checks the total errors across all steps, including errors whose details were truncated, and rejects a step with more failure details than errors. Missing/malformed status, an unrelated failure, an unexpected error count, or an unexpected exit must not pass merely because healthy entities exist.

## Dashboard extension: illustrative only

Offline design validation exercised generic case execution, generated models, SDK pagination, relationship checks, and `DashboardService` cleanup routing. It did **not** exercise a live Metabase server, actual connector ingestion, source provisioning, or live server cleanup. No Metabase fixture, dashboard feature module, or executable Metabase E2E is shipped here.

The example below shows explicit invocation/query/check wiring for a future connector without SQL helpers or a context base class. `seeded_source` and `dashboard_catalog_matches` are proposed connector/feature-local authoring, **not existing imports or fixtures**. Their required contracts follow the example.

```python
from dataclasses import dataclass
import re

import pytest

from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardServiceMetadataPipeline,
)
from ingestion.tests.cli_e2e_v2.runtime import expect
from ingestion.tests.cli_e2e_v2.runtime.cli import WorkflowInvocation
from ingestion.tests.cli_e2e_v2.runtime.expect import Query


@dataclass(frozen=True)
class DashboardSnapshot:
    dashboards: tuple[Dashboard, ...]
    charts: tuple[Chart, ...]


@pytest.fixture
def service_entity():
    return DashboardService


@pytest.mark.e2e_contract("dashboard.metadata")
def test_dashboard_catalog(cli, om, service_name, om_server_config, seeded_source):
    kept = seeded_source.kept_dashboard
    assert kept.source_name and seeded_source.expected_dashboards
    options = DashboardServiceMetadataPipeline(
        dashboardFilterPattern={"includes": [f"^{re.escape(kept.source_name)}$"]},
    )
    invocation = WorkflowInvocation("ingest", {
        "source": {
            "type": "metabase",
            "serviceName": service_name,
            "serviceConnection": {
                "config": seeded_source.connection.model_dump(mode="json", exclude_none=True),
            },
            "sourceConfig": {"config": options.model_dump(mode="json", exclude_none=True)},
        },
        "sink": om_server_config.to_sink_config_dict(),
        "workflowConfig": om_server_config.to_workflow_config_dict(),
    })

    def read():
        return DashboardSnapshot(
            tuple(om.list_all_entities(
                entity=Dashboard, params={"service": service_name}, fields=["charts"],
            )),
            tuple(om.list_all_entities(entity=Chart, params={"service": service_name})),
        )

    cli.run(invocation)
    expect.poll(Query(f"dashboard-service[{service_name}]", read)).satisfies(
        dashboard_catalog_matches(
            expected_dashboards=seeded_source.expected_dashboards,
            expected_charts=seeded_source.expected_charts,
            expected_links=seeded_source.expected_links,
        ),
    )
```

`seeded_source` must receive this run's `service_name`, create owned source objects, and return a generated `MetabaseConnection` plus independently declared expectations. Keep credentials out of fixture representations and logs, apply CI-native masks before setup, and retain environment references in the connection. IDs come from successful source creation, not from OM observations. Source names are filter inputs, while Metabase dashboard/card IDs become OM names: source `Revenue` / ID `42` and chart `Daily revenue` / ID `101` imply `{service_name}.42 → {service_name}.101`.

The ordinary `dashboard_catalog_matches` checker must:

- Validate declared link keys/targets before polling.
- Compare the entire paginated dashboard and chart FQN inventories, rejecting missing/extra entities, duplicate FQNs, and missing FQNs. Never enable SDK `skip_on_failure` or filter unexpected objects out of the observation.
- Unwrap each dashboard's generated `EntityReferenceList`, compare exact chart-FQN membership, and reject missing/duplicate links. `charts=None` fails when links are expected.
- Compare each chart reference's type and UUID with the separately fetched Chart; correct inventory alone does not prove correct membership.

Per fresh filtered service, `Revenue retained + Costs unexpectedly present on page 2` must fail, even when Revenue and its chart are correct. `{42,43}` dashboards and `{101,102}` charts with an incorrect `42→102` link must also fail. Account explicitly for default/synthetic dashboards and orphan charts, or bound source setup so they cannot exist; do not discard them in assertion code.

Cost and limits: every polling attempt materializes both service inventories. A future live connector still needs source authentication/bootstrap, usable questions/data, source-name filtering verification, synthetic-dashboard behavior, persisted convergence/repeat UUID checks, and actual source/server cleanup evidence. None of that requires SQL policy in `runtime/`.

## Coverage inventory and validation

Declare `INVENTORY` in `<connector>/inventory.py`; `family` must match that directory's name. Author required atomic IDs independently of collected cases and place one `pytest.mark.e2e_contract("id")` on each supported case, including parameter-specific marks. MySQL's full declaration is in `mysql/inventory.py`. A future `dashboard_example/` suite could declare:

```python
from ingestion.tests.cli_e2e_v2.contracts.inventory import ContractInventory

INVENTORY = ContractInventory(
    family="dashboard_example",
    required=frozenset({"dashboard.metadata", "chart.membership", "ingest.repeat"}),
)
```

The shared collection validator loads only selected connectors' inventories. No runtime or central registry edit is needed, and missing inventories fail rather than inherit database requirements. Keep inventory modules declarative, use absolute imports, and never provision resources during import.

Do not hide cases behind skip/xfail or downgrade known-supported capabilities. An `unsupported` entry needs a concrete reviewed reason; product bugs are strict failures, not unsupported features. Declare available generated support flags in `capabilities`, keyed by the contract ID's first segment (for example, `profile` → `MysqlConnection.model_fields["supportsProfiler"].get_default(call_default_factory=True)`). A true flag prevents waiving that capability's contracts; narrower features without a corresponding flag still require reviewed reasons.

```bash
python -m pytest ingestion/tests/cli_e2e_v2/mysql --e2e-contract-check --collect-only -q
python -m pytest ingestion/tests/cli_e2e_v2/meta -q
python -m ruff check --config ingestion/pyproject.toml ingestion/tests/cli_e2e_v2
python -m ruff format --config ingestion/pyproject.toml --check ingestion/tests/cli_e2e_v2
git diff --check
```

Run full live connector coverage twice from fresh source stacks and mutation/filter/profile scenarios individually. Inspect persisted results, record genuine exit statuses, and verify cleanup. Offline tests and complete collection do not substitute for live evidence. See [README.md](README.md#debugging-and-reporting) for default failure capture, passing output with `-rP`/`-rA`, and live output with `-s`. Never dump temporary configs/status files into CI logs. Product redaction belongs in focused tests with synthetic secrets, not a sanitizer in this harness.
