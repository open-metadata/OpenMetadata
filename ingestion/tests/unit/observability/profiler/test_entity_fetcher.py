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

SERVICE_REF = EntityReference(
    id=uuid.uuid4(), name="my_service", type="databaseService"
)

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


def _make_fetcher(source_config_overrides=None):
    """Build a DatabaseFetcherStrategy with a mocked metadata client"""
    from copy import deepcopy

    cfg = deepcopy(PROFILER_CONFIG)
    if source_config_overrides:
        cfg["source"]["sourceConfig"]["config"].update(source_config_overrides)
    workflow_config = OpenMetadataWorkflowConfig(**cfg)
    mock_metadata = MagicMock()
    return DatabaseFetcherStrategy(
        config=workflow_config,
        metadata=mock_metadata,
        global_profiler_config=None,
        status=Status(),
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
        fetcher = _make_fetcher(
            {"databaseFilterPattern": {"includes": ["prod", "staging"]}}
        )
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
        fetcher.metadata.list_all_entities.return_value = iter(
            [PROD_DB, STAGING_DB, TEMP_DB]
        )

        result = list(fetcher._get_database_entities())

        call_params = fetcher.metadata.list_all_entities.call_args[1]["params"]
        assert call_params == {"service": "my_service"}
        assert len(result) == 3

    def test_raises_when_server_returns_no_databases(self):
        """If the server returns 0 results (e.g., overly restrictive regex),
        a ValueError should be raised with the filter pattern details."""
        fetcher = _make_fetcher(
            {"databaseFilterPattern": {"includes": ["nonexistent"]}}
        )
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
        fetcher.metadata.list_all_entities.return_value = iter(
            [ORDERS_TABLE, REVENUE_VIEW, CUSTOMERS_TABLE]
        )

        result = list(fetcher._get_table_entities(PROD_DB))

        assert REVENUE_VIEW not in result
        assert result == [ORDERS_TABLE, CUSTOMERS_TABLE]

    def test_views_included_when_configured(self):
        """With includeViews=True, views should pass through."""
        fetcher = _make_fetcher({"includeViews": True})
        fetcher.metadata.list_all_entities.return_value = iter(
            [ORDERS_TABLE, REVENUE_VIEW]
        )

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
        fetcher.metadata.list_all_entities.return_value = iter(
            [EMPLOYEES_TABLE, SALARY_TABLE, UNTAGGED_TABLE]
        )

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
        fetcher.metadata.list_all_entities.return_value = iter(
            [EMPLOYEES_TABLE, SALARY_TABLE, UNTAGGED_TABLE]
        )

        result = list(fetcher._get_table_entities(PROD_DB))

        assert result == [SALARY_TABLE]

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
        fetcher.metadata.list_all_entities.return_value = iter(
            [ORDERS_TABLE, CUSTOMERS_TABLE, REVENUE_VIEW]
        )

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
        fetcher.metadata.list_all_entities.return_value = iter(
            [ORDERS_TABLE, EMPLOYEES_TABLE]
        )

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
    def test_fetch_iterates_databases_and_tables_with_correct_params(
        self, mock_factory
    ):
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
