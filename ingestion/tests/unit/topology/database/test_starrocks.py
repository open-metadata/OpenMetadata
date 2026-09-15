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
Test StarRocks using the topology
"""

from copy import deepcopy
from fnmatch import fnmatch
from unittest import TestCase
from unittest.mock import MagicMock, Mock, patch

import pytest
from sqlalchemy import types as sqltypes

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.lineage.sql_lineage import (
    database_service_type_cache,
    search_cache,
    search_table_entities,
)
from metadata.ingestion.source.database.starrocks.lineage import (
    StarRocksLineageSource,
)
from metadata.ingestion.source.database.starrocks.metadata import (
    StarRocksSource,
    _get_sqlalchemy_type,
)
from metadata.ingestion.source.database.starrocks.queries import STARROCKS_SQL_STATEMENT
from metadata.ingestion.source.database.starrocks.usage import StarRocksUsageSource
from metadata.utils import fqn

mock_starrocks_config = {
    "source": {
        "type": "starrocks",
        "serviceName": "local_starrocks",
        "serviceConnection": {
            "config": {
                "type": "StarRocks",
                "username": "root",
                "hostPort": "localhost:9030",
                "password": "test",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "starrocks"},
        }
    },
}

mock_starrocks_config_with_ssl = {
    "source": {
        "type": "starrocks",
        "serviceName": "local_starrocks_ssl",
        "serviceConnection": {
            "config": {
                "type": "StarRocks",
                "username": "root",
                "hostPort": "localhost:9030",
                "password": "test",
                "sslConfig": {
                    "caCertificate": "-----BEGIN CERTIFICATE-----\nMIIBkTCB+wIJAK...\n-----END CERTIFICATE-----\n",
                },
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "starrocks"},
        }
    },
}


class StarRocksUnitTest(TestCase):
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection")
    def __init__(self, methodName, test_connection) -> None:  # noqa: N803
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_starrocks_config)
        self.starrocks_source = StarRocksSource.create(
            mock_starrocks_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    @patch("sqlalchemy.engine.base.Engine")
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection")
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.starrocks_source.close()


class StarRocksSSLUnitTest(TestCase):
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection")
    def __init__(self, methodName, test_connection) -> None:  # noqa: N803
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_starrocks_config_with_ssl)
        self.starrocks_source = StarRocksSource.create(
            mock_starrocks_config_with_ssl["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_ssl_manager_initialized(self):
        """Test that SSL manager is initialized when SSL config is provided"""
        self.assertIsNotNone(self.starrocks_source.ssl_manager)


class TestStarRocksTypeMappings:
    """Verify _get_sqlalchemy_type returns the correct SQLAlchemy type for every
    type added in the recent type-mapping expansion."""

    @pytest.mark.parametrize(
        "type_str, expected_sqa_class",
        [
            # Integer family
            ("TINYINT", sqltypes.SMALLINT),
            ("SMALLINT", sqltypes.SMALLINT),
            ("INTEGER", sqltypes.INTEGER),
            ("INT", sqltypes.INT),
            ("BIGINT", sqltypes.BIGINT),
            ("LARGEINT", sqltypes.BIGINT),
            # Analytics / semi-structured types stored as TEXT
            ("MAP", sqltypes.TEXT),
            ("STRUCT", sqltypes.TEXT),
            ("BITMAP", sqltypes.TEXT),
            ("HLL", sqltypes.TEXT),
            ("PERCENTILE", sqltypes.TEXT),
            # Existing string types (regression guard)
            ("STRING", sqltypes.TEXT),
            ("TEXT", sqltypes.TEXT),
            ("JSON", sqltypes.JSON),
        ],
    )
    def test_type_resolves_to_expected_class(self, type_str, expected_sqa_class):
        result = _get_sqlalchemy_type(type_str)
        assert isinstance(result, expected_sqa_class), (
            f"_get_sqlalchemy_type('{type_str}') returned {type(result).__name__}, "
            f"expected {expected_sqa_class.__name__}"
        )

    def test_unknown_type_returns_null_type(self):
        result = _get_sqlalchemy_type("UNKNOWN_CUSTOM_TYPE")
        assert isinstance(result, sqltypes.NullType)


class TestStarRocksIcebergMapping(TestCase):
    def test_iceberg_relkind_mapping(self):
        from metadata.generated.schema.entity.data.table import TableType
        from metadata.ingestion.source.database.starrocks.metadata import RELKIND_MAP

        assert RELKIND_MAP["ICEBERG"] == TableType.Iceberg


mock_starrocks_lineage_config = {
    "source": {
        "type": "starrocks-lineage",
        "serviceName": "local_starrocks",
        "serviceConnection": {
            "config": {
                "type": "StarRocks",
                "username": "root",
                "hostPort": "localhost:9030",
                "password": "test",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseLineage",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "starrocks"},
        }
    },
}


@pytest.fixture(autouse=True)
def _clear_lineage_caches():
    """`search_table_entities` memoises per (service, db, schema, table); without this the
    parametrized cases would read each other's results."""
    search_cache.clear()
    database_service_type_cache.clear()
    yield
    search_cache.clear()
    database_service_type_cache.clear()


class TestStarRocksLineageFqnResolution:
    """StarRocks has no database/schema split. Metadata ingestion stores the audit-log `db`
    as the OM *schema*, under a single service-level database, so emitting `db` as the
    database as well built `service.db.db.table` FQNs that matched nothing: lineage was
    parsed and then silently dropped (issue #26600)."""

    SERVICE_NAME = "local_starrocks"
    AUDIT_DB = "sales_db"
    TABLE_NAME = "orders"
    QUERY_TEXT = "INSERT INTO sales_db.target SELECT * FROM sales_db.orders"

    @classmethod
    def _config(cls, template: dict, database_name: str | None) -> dict:
        config = deepcopy(template)
        if database_name:
            config["source"]["serviceConnection"]["config"]["databaseName"] = database_name
        return config

    @classmethod
    def _lineage_source(cls, database_name: str | None = None) -> StarRocksLineageSource:
        config = cls._config(mock_starrocks_lineage_config, database_name)
        with (
            patch("metadata.ingestion.source.database.query_parser_source.get_ssl_connection") as mock_get_engine,
            patch("metadata.ingestion.source.database.query_parser_source.test_connection_common"),
        ):
            mock_get_engine.return_value = MagicMock()
            workflow_config = OpenMetadataWorkflowConfig.model_validate(config)
            return StarRocksLineageSource.create(
                config["source"],
                workflow_config.workflowConfig.openMetadataServerConfig,
            )

    @classmethod
    def _ingested_table_fqn(cls, database_name: str | None = None) -> str:
        """The FQN the *metadata* workflow creates for AUDIT_DB.TABLE_NAME - built from the
        real source so the two halves of the fix cannot drift apart in this test."""
        config = cls._config(mock_starrocks_config, database_name)
        with patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"):
            workflow_config = OpenMetadataWorkflowConfig.model_validate(config)
            metadata_source = StarRocksSource.create(
                config["source"],
                workflow_config.workflowConfig.openMetadataServerConfig,
            )
        ingested_database = next(iter(metadata_source.get_database_names()))
        return fqn._build(cls.SERVICE_NAME, ingested_database, cls.AUDIT_DB, cls.TABLE_NAME)

    @staticmethod
    def _select_aliases() -> dict[str, str]:
        """`alias -> source expression`, parsed out of the connector's own SELECT list."""
        select_list = STARROCKS_SQL_STATEMENT.split("SELECT", 1)[1].split("FROM", 1)[0]

        items, depth, current = [], 0, ""
        for char in select_list:
            depth += (char == "(") - (char == ")")
            if char == "," and depth == 0:
                items.append(current)
                current = ""
            else:
                current += char
        items.append(current)

        aliases = {}
        for item in items:
            expression, _, alias = item.strip().rpartition(" AS ")
            aliases[alias.strip()] = expression.strip()
        return aliases

    @classmethod
    def _audit_row(cls, **audit_record) -> dict:
        """One row as StarRocks would return it: the connector's SELECT list applied to a
        record of the audit table. `NULL` columns come back as None, bare column references
        take the record's value - so `db AS database_name` would put the audit db in the
        database slot, exactly as it did before #26600 was fixed."""
        row = {}
        for alias, expression in cls._select_aliases().items():
            if expression.upper() == "NULL":
                row[alias] = None
            else:
                row[alias] = audit_record.get(expression.strip("`"))
        return row

    @classmethod
    def _table_query(cls, source: StarRocksLineageSource, audit_row: dict) -> TableQuery:
        mock_connection = MagicMock()
        mock_connection.execute.return_value = [audit_row]
        source.engine.connect.return_value.__enter__ = Mock(return_value=mock_connection)
        source.engine.connect.return_value.__exit__ = Mock()

        table_queries = list(source.yield_table_query())
        assert len(table_queries) == 1
        return table_queries[0]

    @staticmethod
    def _metadata_client(ingested_fqn: str, table_entity) -> MagicMock:
        """OMeta double whose table search behaves like the ES wildcard lookup: it returns the
        ingested table only when the FQN search string actually matches its FQN."""
        metadata = MagicMock()

        def es_search_from_fqn(entity_type, fqn_search_string, **_):
            if entity_type is not Table:
                return []
            return [table_entity] if fnmatch(ingested_fqn, fqn_search_string) else []

        metadata.es_search_from_fqn.side_effect = es_search_from_fqn
        # No API fallback available for a wildcarded database - mirrors fqn.build's behaviour
        metadata.get_by_name.return_value = None
        return metadata

    def test_sql_statement_does_not_emit_the_audit_db_as_the_database(self):
        """Pins the fix at its source. The same statement backs usage, so both workflows move
        together."""
        assert "NULL AS database_name" in STARROCKS_SQL_STATEMENT
        assert "db AS schema_name" in STARROCKS_SQL_STATEMENT
        assert "db AS database_name" not in STARROCKS_SQL_STATEMENT
        assert StarRocksUsageSource.sql_stmt is STARROCKS_SQL_STATEMENT
        assert StarRocksLineageSource.sql_stmt is STARROCKS_SQL_STATEMENT

    @pytest.mark.parametrize("configured_database_name", [None, "analytics"])
    def test_emitted_table_query_keeps_the_audit_db_as_schema_only(self, configured_database_name):
        source = self._lineage_source(configured_database_name)
        table_query = self._table_query(source, self._audit_row(db=self.AUDIT_DB, stmt=self.QUERY_TEXT))

        assert table_query.databaseName is None
        assert table_query.databaseSchema == self.AUDIT_DB
        assert table_query.serviceName == self.SERVICE_NAME

    @pytest.mark.parametrize("configured_database_name", [None, "analytics"])
    def test_lookup_resolves_the_table_metadata_ingestion_created(self, configured_database_name):
        """The end the bug was at: the values lineage emits have to find the entity the
        metadata workflow wrote, whether or not `databaseName` was configured."""
        ingested_fqn = self._ingested_table_fqn(configured_database_name)
        table_entity = MagicMock(spec=Table)
        metadata = self._metadata_client(ingested_fqn, table_entity)

        source = self._lineage_source(configured_database_name)
        table_query = self._table_query(source, self._audit_row(db=self.AUDIT_DB, stmt=self.QUERY_TEXT))

        found = search_table_entities(
            metadata=metadata,
            service_names=table_query.serviceName,
            database=table_query.databaseName,
            database_schema=table_query.databaseSchema,
            table=self.TABLE_NAME,
        )

        assert found == [table_entity]

    def test_audit_db_used_as_the_database_finds_nothing(self):
        """What #26600 actually was: `db` in the database slot searches
        `service.sales_db.sales_db.orders`, which no ingested table ever has."""
        ingested_fqn = self._ingested_table_fqn()
        metadata = self._metadata_client(ingested_fqn, MagicMock(spec=Table))

        found = search_table_entities(
            metadata=metadata,
            service_names=self.SERVICE_NAME,
            database=self.AUDIT_DB,
            database_schema=self.AUDIT_DB,
            table=self.TABLE_NAME,
        )

        assert found is None
