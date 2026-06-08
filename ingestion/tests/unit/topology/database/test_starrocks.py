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

from unittest import TestCase
from unittest.mock import patch

import pytest
from sqlalchemy import types as sqltypes

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.starrocks.lineage import normalize_mv_ddl
from metadata.ingestion.source.database.starrocks.metadata import (
    StarRocksSource,
    _get_sqlalchemy_type,
)

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


class TestStarRocksLineageFilters:
    def test_lineage_source_filters_include_mv(self):
        from metadata.ingestion.source.database.starrocks.lineage import StarRocksLineageSource

        assert "CREATE%MATERIALIZED%VIEW%AS%SELECT" in StarRocksLineageSource.filters


class TestStarRocksMvDdlNormalization:
    """Normalization of StarRocks/Doris CREATE MATERIALIZED VIEW DDL into a
    CREATE VIEW form that the SQL lineage parser can handle."""

    def test_basic_with_column_list(self):
        query = (
            "CREATE MATERIALIZED VIEW `mv_order_enriched` (`order_id`, `order_date`, `total_amount`) "
            "DISTRIBUTED BY HASH(`order_id`) BUCKETS 4 "
            "REFRESH ASYNC PROPERTIES ('replication_num'='1') "
            "AS SELECT o.order_id, o.order_date, o.total_amount FROM clean_orders o"
        )
        assert normalize_mv_ddl(query) == (
            "CREATE VIEW `mv_order_enriched` AS "
            "SELECT o.order_id, o.order_date, o.total_amount FROM clean_orders o"
        )

    def test_without_column_list(self):
        query = (
            "CREATE MATERIALIZED VIEW mv_daily_sales "
            "DISTRIBUTED BY HASH(order_date) BUCKETS 4 "
            "REFRESH ASYNC PROPERTIES ('replication_num'='1') "
            "AS SELECT order_date, SUM(amount) AS total FROM orders GROUP BY order_date"
        )
        assert normalize_mv_ddl(query) == (
            "CREATE VIEW mv_daily_sales AS "
            "SELECT order_date, SUM(amount) AS total FROM orders GROUP BY order_date"
        )

    def test_regular_view_is_untouched(self):
        query = "CREATE VIEW my_view AS SELECT * FROM my_table"
        assert normalize_mv_ddl(query) == query

    def test_non_mv_query_is_untouched(self):
        query = "INSERT INTO target SELECT * FROM source"
        assert normalize_mv_ddl(query) == query

    def test_or_replace(self):
        query = (
            "CREATE OR REPLACE MATERIALIZED VIEW mv_daily "
            "DISTRIBUTED BY HASH(order_id) BUCKETS 4 REFRESH ASYNC "
            "AS SELECT order_id FROM clean_orders"
        )
        assert normalize_mv_ddl(query) == "CREATE VIEW mv_daily AS SELECT order_id FROM clean_orders"

    def test_backtick_name_with_hyphen(self):
        query = (
            "CREATE MATERIALIZED VIEW `my-view` "
            "DISTRIBUTED BY HASH(`order-id`) BUCKETS 4 "
            "AS SELECT `order-id` FROM clean_orders"
        )
        assert normalize_mv_ddl(query) == (
            "CREATE VIEW `my-view` AS SELECT `order-id` FROM clean_orders"
        )

    def test_stray_as_in_comment_and_properties(self):
        query = (
            "CREATE MATERIALIZED VIEW mv "
            "COMMENT 'rolls up as needed' "
            "PROPERTIES ('note'='run as batch') "
            "AS SELECT order_id FROM clean_orders"
        )
        assert normalize_mv_ddl(query) == "CREATE VIEW mv AS SELECT order_id FROM clean_orders"

    def test_cte_body_is_preserved(self):
        query = (
            "CREATE MATERIALIZED VIEW mv "
            "DISTRIBUTED BY HASH(order_id) BUCKETS 4 "
            "AS WITH c AS (SELECT order_id FROM clean_orders) SELECT * FROM c"
        )
        assert normalize_mv_ddl(query) == (
            "CREATE VIEW mv AS "
            "WITH c AS (SELECT order_id FROM clean_orders) SELECT * FROM c"
        )


class TestStarRocksViewLineageProducer:
    """The view-lineage path parses ``view_definition`` directly, so the
    StarRocks source must normalize MV definitions there too (not only on the
    query-log path)."""

    def _make_view(self, view_definition):
        from metadata.ingestion.source.models import TableView

        return TableView(
            table_name="mv",
            schema_name="s",
            db_name="d",
            view_definition=view_definition,
        )

    def test_view_definitions_are_normalized(self):
        from unittest.mock import patch

        from metadata.ingestion.source.database.lineage_source import LineageSource
        from metadata.ingestion.source.database.starrocks.lineage import (
            StarRocksLineageSource,
        )

        mv = self._make_view(
            "CREATE MATERIALIZED VIEW mv DISTRIBUTED BY HASH(id) BUCKETS 4 "
            "REFRESH ASYNC AS SELECT id FROM t"
        )
        plain = self._make_view("SELECT a FROM t")
        empty = self._make_view(None)

        source = StarRocksLineageSource.__new__(StarRocksLineageSource)
        with patch.object(
            LineageSource,
            "view_lineage_producer",
            lambda self: iter([mv, plain, empty]),
        ):
            produced = list(source.view_lineage_producer())

        assert produced[0].view_definition == "CREATE VIEW mv AS SELECT id FROM t"
        assert produced[1].view_definition == "SELECT a FROM t"
        assert produced[2].view_definition is None
