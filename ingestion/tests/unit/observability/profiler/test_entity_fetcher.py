#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Validate entity fetcher filtering strategies
"""

import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    Column,
    DataType,
    Table,
    TableType,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    DatabaseServiceAutoClassificationPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.status import Status
from metadata.ingestion.progress.modes import ManualProgress
from metadata.ingestion.progress.registry import ProgressRegistry
from metadata.profiler.source.fetcher.fetcher_strategy import DatabaseFetcherStrategy
from metadata.profiler.source.profiler_source_interface import ProfilerSourceInterface

VIEW = Table(
    id=uuid.uuid4(),
    name="view",
    columns=[],
    tableType=TableType.View,
)

TABLE = Table(
    id=uuid.uuid4(),
    name="table",
    columns=[],
    tableType=TableType.Regular,
)


def get_db_fetcher(source_config):
    """Fetch database"""
    workflow_config = OpenMetadataWorkflowConfig(
        source=Source(
            type="mysql",
            serviceName="mysql",
            sourceConfig=SourceConfig(
                config=source_config,
            ),
        ),
        workflowConfig=WorkflowConfig(
            openMetadataServerConfig=OpenMetadataConnection(
                hostPort="localhost:8585/api",
            )
        ),
    )
    return DatabaseFetcherStrategy(
        config=workflow_config,
        metadata=...,
        global_profiler_config=...,
        status=Status(),
        progress=ManualProgress(ProgressRegistry()),
    )


def test_include_views():
    """Validate we can include/exclude views"""
    config = DatabaseServiceAutoClassificationPipeline(
        includeViews=False,
    )
    fetcher = get_db_fetcher(config)

    assert fetcher._filter_views(VIEW)
    assert not fetcher._filter_views(TABLE)

    config = DatabaseServiceAutoClassificationPipeline(
        includeViews=True,
    )
    fetcher = get_db_fetcher(config)

    assert not fetcher._filter_views(VIEW)
    assert not fetcher._filter_views(TABLE)


PROFILER_CONFIG = {
    "source": {
        "type": "sqlite",
        "serviceName": "my_service",
        "serviceConnection": {"config": {"type": "SQLite"}},
        "sourceConfig": {"config": {"type": "Profiler"}},
    },
    "processor": {"type": "orm-profiler", "config": {}},
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "fake.jwt.token"},
        }
    },
}

SERVICE_REF = EntityReference(id=uuid.uuid4(), name="my_service", type="databaseService")

PROD_DB = Database(
    id=uuid.uuid4(),
    name="prod",
    fullyQualifiedName="my_service.prod",
    service=SERVICE_REF,
)

STAGING_DB = Database(
    id=uuid.uuid4(),
    name="staging",
    fullyQualifiedName="my_service.staging",
    service=SERVICE_REF,
)

TEMP_DB = Database(
    id=uuid.uuid4(),
    name="temp_analytics",
    fullyQualifiedName="my_service.temp_analytics",
    service=SERVICE_REF,
)

NO_FQN_DB = Database(
    id=uuid.uuid4(),
    name="no_fqn",
    service=SERVICE_REF,
)

FINANCE_SCHEMA_REF = EntityReference(
    id=uuid.uuid4(),
    name="finance",
    type="databaseSchema",
    fullyQualifiedName="my_service.prod.finance",
)

HR_SCHEMA_REF = EntityReference(
    id=uuid.uuid4(),
    name="hr",
    type="databaseSchema",
    fullyQualifiedName="my_service.prod.hr",
)

DB_REF = EntityReference(id=uuid.uuid4(), name="prod", type="database")

ORDERS_TABLE = Table(
    id=uuid.uuid4(),
    name="orders",
    fullyQualifiedName="my_service.prod.finance.orders",
    columns=[Column(name="id", dataType=DataType.INT)],
    database=DB_REF,
    databaseSchema=FINANCE_SCHEMA_REF,
    tableType=TableType.Regular,
)

CUSTOMERS_TABLE = Table(
    id=uuid.uuid4(),
    name="customers",
    fullyQualifiedName="my_service.prod.finance.customers",
    columns=[Column(name="id", dataType=DataType.INT)],
    database=DB_REF,
    databaseSchema=FINANCE_SCHEMA_REF,
    tableType=TableType.Regular,
)

EMPLOYEES_TABLE = Table(
    id=uuid.uuid4(),
    name="employees",
    fullyQualifiedName="my_service.prod.hr.employees",
    columns=[Column(name="id", dataType=DataType.INT)],
    database=DB_REF,
    databaseSchema=HR_SCHEMA_REF,
    tableType=TableType.Regular,
)

REVENUE_VIEW = Table(
    id=uuid.uuid4(),
    name="revenue_summary",
    fullyQualifiedName="my_service.prod.finance.revenue_summary",
    columns=[Column(name="total", dataType=DataType.DECIMAL)],
    database=DB_REF,
    databaseSchema=FINANCE_SCHEMA_REF,
    tableType=TableType.View,
)

SALARY_TABLE = Table(
    id=uuid.uuid4(),
    name="salaries",
    fullyQualifiedName="my_service.prod.hr.salaries",
    columns=[Column(name="amount", dataType=DataType.DECIMAL)],
    database=DB_REF,
    databaseSchema=HR_SCHEMA_REF,
    tableType=TableType.Regular,
    tags=[
        TagLabel(
            labelType="Manual",
            name="PII",
            tagFQN="PII.Sensitive",
            state="Confirmed",
            source="Classification",
        ),
    ],
)

UNTAGGED_TABLE = Table(
    id=uuid.uuid4(),
    name="departments",
    fullyQualifiedName="my_service.prod.hr.departments",
    columns=[Column(name="name", dataType=DataType.STRING)],
    database=DB_REF,
    databaseSchema=HR_SCHEMA_REF,
    tableType=TableType.Regular,
)

MULTI_TAG_TABLE = Table(
    id=uuid.uuid4(),
    name="transactions",
    fullyQualifiedName="my_service.prod.finance.transactions",
    columns=[Column(name="id", dataType=DataType.INT)],
    database=DB_REF,
    databaseSchema=FINANCE_SCHEMA_REF,
    tableType=TableType.Regular,
    tags=[
        TagLabel(
            labelType="Manual",
            name="PII",
            tagFQN="PII.Sensitive",
            state="Confirmed",
            source="Classification",
        ),
        TagLabel(
            labelType="Manual",
            name="Revenue",
            tagFQN="Finance.Revenue",
            state="Confirmed",
            source="Classification",
        ),
    ],
)

TIER_REVENUE_TABLE = Table(
    id=uuid.uuid4(),
    name="ledger",
    fullyQualifiedName="my_service.prod.finance.ledger",
    columns=[Column(name="id", dataType=DataType.INT)],
    database=DB_REF,
    databaseSchema=FINANCE_SCHEMA_REF,
    tableType=TableType.Regular,
    tags=[
        TagLabel(
            labelType="Manual",
            name="Tier1",
            tagFQN="Tier.Tier1",
            state="Confirmed",
            source="Classification",
        ),
        TagLabel(
            labelType="Manual",
            name="Revenue",
            tagFQN="Finance.Revenue",
            state="Confirmed",
            source="Classification",
        ),
    ],
)


def _make_fetcher(source_config_overrides=None):
    """Build a DatabaseFetcherStrategy with a mocked metadata client"""
    from copy import deepcopy

    cfg = deepcopy(PROFILER_CONFIG)
    if source_config_overrides:
        cfg["source"]["sourceConfig"]["config"].update(source_config_overrides)
    workflow_config = OpenMetadataWorkflowConfig(**cfg)
    mock_metadata = MagicMock()
    mock_metadata.list_entities.return_value = SimpleNamespace(total=0)
    return DatabaseFetcherStrategy(
        config=workflow_config,
        metadata=mock_metadata,
        global_profiler_config=None,
        status=Status(),
        progress=ManualProgress(ProgressRegistry()),
    )


class TestGetDatabaseEntities:
    """Validate _get_database_entities generator and param passing"""

    def test_include_pattern_sends_regex_and_yields_matching_databases(self):
        """With includes=["prod"], the API receives databaseRegex="prod"
        with regexMode=include. The server returns only matching databases."""
        fetcher = _make_fetcher({"databaseFilterPattern": {"includes": ["prod"]}})
        fetcher.metadata.list_all_entities.return_value = iter([PROD_DB])

        result = list(fetcher._get_database_entities())

        fetcher.metadata.list_all_entities.assert_called_once_with(
            entity=Database,
            params={
                "service": "my_service",
                "databaseRegex": "prod",
                "regexMode": "include",
            },
        )
        assert result == [PROD_DB]

    def test_exclude_pattern_sends_exclude_mode(self):
        """With excludes=["temp.*"], the API receives regexMode=exclude.
        The server filters out temp_analytics and returns only prod+staging."""
        fetcher = _make_fetcher({"databaseFilterPattern": {"excludes": ["temp.*"]}})
        fetcher.metadata.list_all_entities.return_value = iter([PROD_DB, STAGING_DB])

        result = list(fetcher._get_database_entities())

        call_params = fetcher.metadata.list_all_entities.call_args[1]["params"]
        assert call_params["databaseRegex"] == "temp.*"
        assert call_params["regexMode"] == "exclude"
        assert result == [PROD_DB, STAGING_DB]
        assert TEMP_DB not in result

    def test_multiple_includes_combined_with_or(self):
        """includes=["prod", "staging"] combines into "(prod)|(staging)".
        The server returns both matching databases but not temp_analytics."""
        fetcher = _make_fetcher({"databaseFilterPattern": {"includes": ["prod", "staging"]}})
        fetcher.metadata.list_all_entities.return_value = iter([PROD_DB, STAGING_DB])

        result = list(fetcher._get_database_entities())

        call_params = fetcher.metadata.list_all_entities.call_args[1]["params"]
        assert call_params["databaseRegex"] == "(prod)|(staging)"
        assert result == [PROD_DB, STAGING_DB]
        assert TEMP_DB not in result

    def test_fqn_filtering_adds_regex_filter_by_fqn(self):
        """When useFqnForFiltering=True, regexFilterByFqn must be passed
        so the server matches against fullyQualifiedName, not just name.
        Only prod matches "my_service\\.prod"."""
        fetcher = _make_fetcher(
            {
                "useFqnForFiltering": True,
                "databaseFilterPattern": {"includes": ["my_service\\.prod"]},
            }
        )
        fetcher.metadata.list_all_entities.return_value = iter([PROD_DB])

        result = list(fetcher._get_database_entities())

        call_params = fetcher.metadata.list_all_entities.call_args[1]["params"]
        assert call_params["regexFilterByFqn"] == "true"
        assert call_params["databaseRegex"] == "my_service\\.prod"
        assert result == [PROD_DB]

    def test_no_filter_pattern_fetches_all_databases(self):
        """Without a filter pattern, no regex params should be sent
        and the API returns all databases for the service."""
        fetcher = _make_fetcher()
        fetcher.metadata.list_all_entities.return_value = iter([PROD_DB, STAGING_DB, TEMP_DB])

        result = list(fetcher._get_database_entities())

        call_params = fetcher.metadata.list_all_entities.call_args[1]["params"]
        assert call_params == {"service": "my_service"}
        assert len(result) == 3

    def test_raises_when_server_returns_no_databases(self):
        """If the server returns 0 results (e.g., overly restrictive regex),
        a ValueError should be raised with the filter pattern details."""
        fetcher = _make_fetcher({"databaseFilterPattern": {"includes": ["nonexistent"]}})
        fetcher.metadata.list_all_entities.return_value = iter([])

        with pytest.raises(ValueError, match="databaseFilterPattern returned 0 result"):
            list(fetcher._get_database_entities())


class TestGetTableEntities:
    """Validate _get_table_entities generator, param passing, and client-side filters"""

    def test_schema_and_table_includes_sent_as_regex(self):
        """With schemaFilterPattern=finance and tableFilterPattern=orders,
        the server returns only finance.orders — not hr tables or customers."""
        fetcher = _make_fetcher(
            {
                "schemaFilterPattern": {"includes": ["finance"]},
                "tableFilterPattern": {"includes": ["orders"]},
                "includeViews": True,
            }
        )
        fetcher.metadata.list_all_entities.return_value = iter([ORDERS_TABLE])

        result = list(fetcher._get_table_entities(PROD_DB))

        call_params = fetcher.metadata.list_all_entities.call_args[1]["params"]
        assert call_params["databaseSchemaRegex"] == "finance"
        assert call_params["tableRegex"] == "orders"
        assert call_params["regexMode"] == "include"
        assert call_params["database"] == "my_service.prod"
        assert result == [ORDERS_TABLE]

    def test_views_filtered_client_side_from_mixed_results(self):
        """The API returns a mix of regular tables and views.
        With includeViews=False, views must be stripped client-side."""
        fetcher = _make_fetcher({"includeViews": False})
        fetcher.metadata.list_all_entities.return_value = iter([ORDERS_TABLE, REVENUE_VIEW, CUSTOMERS_TABLE])

        result = list(fetcher._get_table_entities(PROD_DB))

        assert REVENUE_VIEW not in result
        assert result == [ORDERS_TABLE, CUSTOMERS_TABLE]

    def test_views_included_when_configured(self):
        """With includeViews=True, views should pass through."""
        fetcher = _make_fetcher({"includeViews": True})
        fetcher.metadata.list_all_entities.return_value = iter([ORDERS_TABLE, REVENUE_VIEW])

        result = list(fetcher._get_table_entities(PROD_DB))

        assert result == [ORDERS_TABLE, REVENUE_VIEW]

    def test_classification_exclude_filters_tagged_tables(self):
        """With classificationFilterPattern excludes=["PII"],
        tables tagged with PII should be removed client-side
        while untagged tables pass through."""
        fetcher = _make_fetcher(
            {
                "classificationFilterPattern": {"excludes": ["PII.*"]},
            }
        )
        fetcher.metadata.list_all_entities.return_value = iter([EMPLOYEES_TABLE, SALARY_TABLE, UNTAGGED_TABLE])

        result = list(fetcher._get_table_entities(PROD_DB))

        assert SALARY_TABLE not in result
        assert result == [EMPLOYEES_TABLE, UNTAGGED_TABLE]

    def test_classification_include_filters_untagged_tables(self):
        """With classificationFilterPattern includes=["PII.*"],
        only tables with matching tags should be returned.
        Untagged tables and tables without matching tags are excluded."""
        fetcher = _make_fetcher(
            {
                "classificationFilterPattern": {"includes": ["PII.*"]},
            }
        )
        fetcher.metadata.list_all_entities.return_value = iter([EMPLOYEES_TABLE, SALARY_TABLE, UNTAGGED_TABLE])

        result = list(fetcher._get_table_entities(PROD_DB))

        assert result == [SALARY_TABLE]

    def test_classification_include_keeps_table_with_extra_tags(self):
        """A table carrying a matching include tag is kept even when it also
        has other, non-matching tags. A single matching tag is sufficient."""
        fetcher = _make_fetcher(
            {
                "classificationFilterPattern": {"includes": ["PII.*"]},
            }
        )
        fetcher.metadata.list_all_entities.return_value = iter([MULTI_TAG_TABLE, TIER_REVENUE_TABLE])

        result = list(fetcher._get_table_entities(PROD_DB))

        assert result == [MULTI_TAG_TABLE]

    def test_classification_exclude_takes_precedence_over_include(self):
        """When a table matches both an include and an exclude pattern,
        exclude wins and the table is filtered out."""
        fetcher = _make_fetcher(
            {
                "classificationFilterPattern": {
                    "includes": ["Tier.*"],
                    "excludes": ["Revenue.*"],
                },
            }
        )
        fetcher.metadata.list_all_entities.return_value = iter([TIER_REVENUE_TABLE])

        result = list(fetcher._get_table_entities(PROD_DB))

        assert result == []

    def test_classification_exclude_keeps_multi_tag_table_without_excluded_tag(self):
        """A multi-tag table is kept when none of its tags match the exclude
        pattern, regardless of how many other tags it carries."""
        fetcher = _make_fetcher(
            {
                "classificationFilterPattern": {"excludes": ["PII.*"]},
            }
        )
        fetcher.metadata.list_all_entities.return_value = iter([TIER_REVENUE_TABLE, MULTI_TAG_TABLE])

        result = list(fetcher._get_table_entities(PROD_DB))

        assert result == [TIER_REVENUE_TABLE]

    def test_views_and_classifications_combined(self):
        """Both view filtering and classification filtering
        should apply simultaneously."""
        fetcher = _make_fetcher(
            {
                "includeViews": False,
                "classificationFilterPattern": {"excludes": ["PII.*"]},
            }
        )
        fetcher.metadata.list_all_entities.return_value = iter(
            [ORDERS_TABLE, REVENUE_VIEW, SALARY_TABLE, UNTAGGED_TABLE]
        )

        result = list(fetcher._get_table_entities(PROD_DB))

        assert REVENUE_VIEW not in result
        assert SALARY_TABLE not in result
        assert result == [ORDERS_TABLE, UNTAGGED_TABLE]

    def test_default_config_excludes_views_only(self):
        """Default config has includeViews=False and no classification filter.
        Only views should be excluded."""
        fetcher = _make_fetcher()
        fetcher.metadata.list_all_entities.return_value = iter(
            [ORDERS_TABLE, REVENUE_VIEW, SALARY_TABLE, UNTAGGED_TABLE]
        )

        result = list(fetcher._get_table_entities(PROD_DB))

        assert REVENUE_VIEW not in result
        assert result == [ORDERS_TABLE, SALARY_TABLE, UNTAGGED_TABLE]

    def test_fqn_filtering_with_schema_exclude(self):
        """useFqnForFiltering + schema exclude sends regexFilterByFqn.
        Server excludes hr schema tables, returns only finance tables."""
        fetcher = _make_fetcher(
            {
                "useFqnForFiltering": True,
                "schemaFilterPattern": {"excludes": ["my_service\\.prod\\.hr"]},
                "includeViews": True,
            }
        )
        finance_tables = [ORDERS_TABLE, CUSTOMERS_TABLE, REVENUE_VIEW]
        fetcher.metadata.list_all_entities.return_value = iter(finance_tables)

        result = list(fetcher._get_table_entities(PROD_DB))

        call_params = fetcher.metadata.list_all_entities.call_args[1]["params"]
        assert call_params["regexFilterByFqn"] == "true"
        assert call_params["databaseSchemaRegex"] == "my_service\\.prod\\.hr"
        assert call_params["regexMode"] == "exclude"
        assert result == finance_tables
        assert EMPLOYEES_TABLE not in result
        assert SALARY_TABLE not in result

    def test_no_regex_params_when_no_schema_or_table_filter(self):
        """Without schema or table filters, no regex params should be sent.
        The API returns all tables for the database."""
        fetcher = _make_fetcher({"includeViews": True})
        all_tables = [
            ORDERS_TABLE,
            CUSTOMERS_TABLE,
            EMPLOYEES_TABLE,
            REVENUE_VIEW,
            SALARY_TABLE,
            UNTAGGED_TABLE,
        ]
        fetcher.metadata.list_all_entities.return_value = iter(all_tables)

        result = list(fetcher._get_table_entities(PROD_DB))

        call_params = fetcher.metadata.list_all_entities.call_args[1]["params"]
        assert "databaseSchemaRegex" not in call_params
        assert "tableRegex" not in call_params
        assert "regexMode" not in call_params
        assert len(result) == len(all_tables)

    def test_conflicting_modes_include_schema_exclude_table(self):
        """When schemaFilterPattern uses includes and tableFilterPattern
        uses excludes, only the schema include is pushed to the backend.
        The table exclude is applied client-side."""
        fetcher = _make_fetcher(
            {
                "schemaFilterPattern": {"includes": ["finance"]},
                "tableFilterPattern": {"excludes": ["customers"]},
                "includeViews": True,
            }
        )
        fetcher.metadata.list_all_entities.return_value = iter([ORDERS_TABLE, CUSTOMERS_TABLE, REVENUE_VIEW])

        result = list(fetcher._get_table_entities(PROD_DB))

        call_params = fetcher.metadata.list_all_entities.call_args[1]["params"]
        assert call_params["databaseSchemaRegex"] == "finance"
        assert call_params["regexMode"] == "include"
        assert "tableRegex" not in call_params
        assert CUSTOMERS_TABLE not in result
        assert result == [ORDERS_TABLE, REVENUE_VIEW]

    def test_conflicting_modes_exclude_schema_include_table(self):
        """When schemaFilterPattern uses excludes and tableFilterPattern
        uses includes, only the table include is pushed to the backend.
        The schema exclude is applied client-side."""
        fetcher = _make_fetcher(
            {
                "schemaFilterPattern": {"excludes": ["hr"]},
                "tableFilterPattern": {"includes": ["orders"]},
                "includeViews": True,
            }
        )
        fetcher.metadata.list_all_entities.return_value = iter([ORDERS_TABLE, EMPLOYEES_TABLE])

        result = list(fetcher._get_table_entities(PROD_DB))

        call_params = fetcher.metadata.list_all_entities.call_args[1]["params"]
        assert call_params["tableRegex"] == "orders"
        assert call_params["regexMode"] == "include"
        assert "databaseSchemaRegex" not in call_params
        assert EMPLOYEES_TABLE not in result
        assert result == [ORDERS_TABLE]


class TestFetch:
    """Validate end-to-end fetch() pipeline across multiple databases"""

    @patch("metadata.profiler.source.fetcher.fetcher_strategy.profiler_source_factory")
    def test_fetch_iterates_databases_and_tables_with_correct_params(self, mock_factory):
        """fetch() should iterate over each database from _get_database_entities,
        then for each database call _get_table_entities with the right params.
        Verifies the full param chain from config to API calls."""
        mock_factory.create.return_value = MagicMock(spec=ProfilerSourceInterface)
        fetcher = _make_fetcher(
            {
                "databaseFilterPattern": {"includes": ["prod", "staging"]},
                "schemaFilterPattern": {"includes": ["finance"]},
                "includeViews": True,
            }
        )
        fetcher.metadata.list_all_entities.side_effect = [
            iter([PROD_DB, STAGING_DB]),
            iter([ORDERS_TABLE, CUSTOMERS_TABLE]),
            iter([]),
        ]

        results = list(fetcher.fetch())

        entities = [r.right.entity for r in results if r.right]
        assert entities == [ORDERS_TABLE, CUSTOMERS_TABLE]

        (
            db_call,
            table_call_1,
            table_call_2,
        ) = fetcher.metadata.list_all_entities.call_args_list

        db_params = db_call[1]["params"]
        assert db_params["databaseRegex"] == "(prod)|(staging)"
        assert db_params["regexMode"] == "include"

        table_params_1 = table_call_1[1]["params"]
        assert table_params_1["database"] == "my_service.prod"
        assert table_params_1["databaseSchemaRegex"] == "finance"

        table_params_2 = table_call_2[1]["params"]
        assert table_params_2["database"] == "my_service.staging"
        assert table_params_2["databaseSchemaRegex"] == "finance"

    @patch("metadata.profiler.source.fetcher.fetcher_strategy.profiler_source_factory")
    def test_fetch_applies_client_side_filters_on_server_results(self, mock_factory):
        """The server returns tables including views and PII-tagged tables.
        fetch() must strip views and PII tables client-side while
        keeping everything else."""
        mock_factory.create.return_value = MagicMock(spec=ProfilerSourceInterface)
        fetcher = _make_fetcher(
            {
                "includeViews": False,
                "classificationFilterPattern": {"excludes": ["PII.*"]},
            }
        )
        fetcher.metadata.list_all_entities.side_effect = [
            iter([PROD_DB]),
            iter(
                [
                    ORDERS_TABLE,
                    REVENUE_VIEW,
                    SALARY_TABLE,
                    CUSTOMERS_TABLE,
                    UNTAGGED_TABLE,
                ]
            ),
        ]

        results = list(fetcher.fetch())

        entities = [r.right.entity for r in results if r.right]
        assert REVENUE_VIEW not in entities
        assert SALARY_TABLE not in entities
        assert entities == [ORDERS_TABLE, CUSTOMERS_TABLE, UNTAGGED_TABLE]

    @patch("metadata.profiler.source.fetcher.fetcher_strategy.profiler_source_factory")
    def test_fetch_handles_profiler_source_error_per_database(self, mock_factory):
        """If profiler_source_factory.create fails for one database,
        it should yield an error for that database but continue
        processing the next one."""
        call_count = 0

        def create_side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("connection failed for prod")
            return MagicMock(spec=ProfilerSourceInterface)

        mock_factory.create.side_effect = create_side_effect
        fetcher = _make_fetcher()
        fetcher.metadata.list_all_entities.side_effect = [
            iter([PROD_DB, STAGING_DB]),
            iter([ORDERS_TABLE]),
        ]

        results = list(fetcher.fetch())

        assert len(results) == 2
        assert results[0].left is not None
        assert "connection failed for prod" in results[0].left.error
        assert results[1].right is not None
        assert results[1].right.entity == ORDERS_TABLE

    @patch("metadata.profiler.source.fetcher.fetcher_strategy.profiler_source_factory")
    def test_fetch_does_not_abort_loop_when_database_lacks_fqn(self, mock_factory):
        """A database missing fullyQualifiedName must not raise out of fetch()
        and abort the remaining databases. It degrades to a single error record
        while the sibling database is still fully processed."""
        mock_factory.create.return_value = MagicMock(spec=ProfilerSourceInterface)
        fetcher = _make_fetcher({"includeViews": True})
        fetcher.metadata.list_all_entities.side_effect = [
            iter([NO_FQN_DB, PROD_DB]),
            iter([ORDERS_TABLE]),
        ]

        results = list(fetcher.fetch())

        errors = [r.left for r in results if r.left]
        entities = [r.right.entity for r in results if r.right]
        assert len(errors) == 1
        assert errors[0].name == "no_fqn"
        assert entities == [ORDERS_TABLE]


def _db_strategy_with_progress(tables, server_total, capture=None):
    """DatabaseFetcherStrategy wired with a real ProgressRegistry, with its
    database/table enumeration and profiler_source stubbed so fetch() runs in
    isolation. `server_total` is what the seed count call reports."""
    registry = ProgressRegistry()
    progress = ManualProgress(registry)

    strategy = DatabaseFetcherStrategy.__new__(DatabaseFetcherStrategy)
    strategy.progress = progress
    strategy.config = SimpleNamespace(source=SimpleNamespace(type="mysql"))
    strategy.global_profiler_config = None
    strategy.metadata = MagicMock()
    strategy.metadata.list_entities.return_value = SimpleNamespace(total=server_total)

    database = SimpleNamespace(fullyQualifiedName=SimpleNamespace(root="svc.db"))
    strategy._get_database_entities = lambda: iter([database])
    strategy._build_table_params = lambda db: {}

    def _tables(_db):
        first = True
        for table in tables:
            if capture is not None and first:
                capture["mid"] = registry.global_counters()
                first = False
            yield table

    strategy._get_table_entities = _tables
    return strategy, registry, progress


def _multi_db_strategy_with_progress(db_specs):
    """DatabaseFetcherStrategy wired with a real ProgressRegistry across
    MULTIPLE databases, each with its own seeded server total and its own
    table list, to guard the per-database-scope reconciliation that sums
    into a single global `Table` counter. `db_specs` is an ordered mapping
    of database FQN -> (seed_total, tables)."""
    registry = ProgressRegistry()
    progress = ManualProgress(registry)

    strategy = DatabaseFetcherStrategy.__new__(DatabaseFetcherStrategy)
    strategy.progress = progress
    strategy.config = SimpleNamespace(source=SimpleNamespace(type="mysql"))
    strategy.global_profiler_config = None
    strategy.metadata = MagicMock()
    strategy.metadata.list_entities.side_effect = [SimpleNamespace(total=seed) for seed, _ in db_specs.values()]

    databases = [SimpleNamespace(fullyQualifiedName=SimpleNamespace(root=fqn)) for fqn in db_specs]
    strategy._get_database_entities = lambda: iter(databases)
    strategy._build_table_params = lambda db: {}
    strategy._get_table_entities = lambda db: iter(db_specs[db.fullyQualifiedName.root][1])
    return strategy, registry, progress


class TestDatabaseFetcherProgress:
    def test_seeds_server_total_then_reconciles_to_observed(self):
        with patch(
            "metadata.profiler.source.fetcher.fetcher_strategy.profiler_source_factory.create",
            return_value=MagicMock(spec=ProfilerSourceInterface),
        ):
            strategy, registry, _ = _db_strategy_with_progress(tables=[TABLE, TABLE], server_total=5)
            records = list(strategy.fetch())

        assert len(records) == 2
        assert registry.global_counters() == [("Table", 2, 2)]
        assert registry.assets_ingested() == 2

    def test_seed_visible_before_reconcile(self):
        capture = {}
        with patch(
            "metadata.profiler.source.fetcher.fetcher_strategy.profiler_source_factory.create",
            return_value=MagicMock(spec=ProfilerSourceInterface),
        ):
            strategy, _, _ = _db_strategy_with_progress(tables=[TABLE, TABLE], server_total=5, capture=capture)
            list(strategy.fetch())

        assert capture["mid"] == [("Table", 0, 5)]

    def test_seed_failure_falls_back_to_reconcile(self):
        with patch(
            "metadata.profiler.source.fetcher.fetcher_strategy.profiler_source_factory.create",
            return_value=MagicMock(spec=ProfilerSourceInterface),
        ):
            strategy, registry, _ = _db_strategy_with_progress(tables=[TABLE], server_total=0)
            strategy.metadata.list_entities.side_effect = RuntimeError("boom")
            records = list(strategy.fetch())

        assert len(records) == 1
        assert registry.global_counters() == [("Table", 1, 1)]
        assert registry.assets_ingested() == 1

    def test_multi_database_aggregates_into_single_table_counter(self):
        """Each database seeds and reconciles its own scope, but they all
        roll up into one global `Table` counter: seeded totals (3 + 2) walk
        down to observed totals (2 + 2) as each database's tables complete."""
        with patch(
            "metadata.profiler.source.fetcher.fetcher_strategy.profiler_source_factory.create",
            return_value=MagicMock(spec=ProfilerSourceInterface),
        ):
            strategy, registry, _ = _multi_db_strategy_with_progress(
                {
                    "svc.db1": (3, [TABLE, TABLE]),
                    "svc.db2": (2, [TABLE, TABLE]),
                }
            )
            records = list(strategy.fetch())

        assert len(records) == 4
        assert registry.global_counters() == [("Table", 4, 4)]
        assert registry.assets_ingested() == 4

    def test_partial_db_failure_walks_back_phantom_seed(self):
        """A failure creating the profiler source for db1 must not leave its
        seeded total (5) inflating the shared `Table` counter: the `finally`
        reconcile walks the phantom seed back to `observed=0` for that scope,
        while db2 still contributes its real, completed total."""

        def create_side_effect(*args, **kwargs):
            database = args[2]
            if database.fullyQualifiedName.root == "svc.db1":
                raise RuntimeError("connection failed for db1")
            return MagicMock(spec=ProfilerSourceInterface)

        with patch(
            "metadata.profiler.source.fetcher.fetcher_strategy.profiler_source_factory.create",
            side_effect=create_side_effect,
        ):
            strategy, registry, _ = _multi_db_strategy_with_progress(
                {
                    "svc.db1": (5, [TABLE, TABLE]),
                    "svc.db2": (2, [TABLE, TABLE]),
                }
            )
            records = list(strategy.fetch())

        errors = [record for record in records if record.left is not None]
        assert len(errors) == 1
        assert "connection failed for db1" in errors[0].left.error
        assert registry.global_counters() == [("Table", 2, 2)]
        assert registry.assets_ingested() == 2
