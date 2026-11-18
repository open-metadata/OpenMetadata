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
Test Greenplum using the topology
"""

from unittest import TestCase
from unittest.mock import MagicMock, PropertyMock, patch

import pytest
from sqlalchemy.exc import SQLAlchemyError

from metadata.generated.schema.entity.data.table import Column, ConstraintType, DataType, TableConstraint, TableType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.greenplum.metadata import GreenplumSource

mock_greenplum_config = {
    "source": {
        "type": "greenplum",
        "serviceName": "local_greenplum1",
        "serviceConnection": {
            "config": {
                "type": "Greenplum",
                "username": "username",
                "authType": {
                    "password": "password",
                },
                "hostPort": "localhost:5432",
                "database": "greenplum",
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
            "securityConfig": {"jwtToken": "greenplum"},
        }
    },
}


class greenplumUnitTest(TestCase):  # noqa: N801
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection")
    def setUp(self, test_connection) -> None:
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_greenplum_config)
        self.greenplum_source = GreenplumSource.create(
            mock_greenplum_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    @patch("sqlalchemy.engine.base.Engine")
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection")
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.greenplum_source.close()

    def test_query_view_names_and_types_includes_materialized_views(self):
        """
        includeViews=True: materialized views are emitted as MaterializedView
        alongside regular views (#31515).
        """
        mock_inspector = MagicMock()
        mock_inspector.get_view_names.return_value = ["regular_view"]
        mock_inspector.get_materialized_view_names.return_value = ["my_matview"]

        with patch.object(GreenplumSource, "inspector", mock_inspector):
            results = list(self.greenplum_source.query_view_names_and_types("public"))

        self.assertEqual(
            {result.name: result.type_ for result in results},
            {
                "regular_view": TableType.View,
                "my_matview": TableType.MaterializedView,
            },
        )

    def test_regular_views_survive_matview_lookup_failure(self):
        """
        Greenplum versions without materialized-view support must still yield
        regular views instead of losing the whole schema.
        """
        mock_inspector = MagicMock()
        mock_inspector.get_view_names.return_value = ["regular_view"]
        mock_inspector.get_materialized_view_names.side_effect = Exception("unsupported")

        with patch.object(GreenplumSource, "inspector", mock_inspector):
            results = list(self.greenplum_source.query_view_names_and_types("public"))

        self.assertEqual([(r.name, r.type_) for r in results], [("regular_view", TableType.View)])


@pytest.fixture
def distribution_source():
    with patch.object(GreenplumSource, "test_connection"):
        source = GreenplumSource.create(mock_greenplum_config["source"], MagicMock())
    with patch.object(GreenplumSource, "connection", new_callable=PropertyMock) as connection:
        connection.return_value.dialect.server_version_info = (9, 4, 26)
        try:
            yield source, connection.return_value
        finally:
            source.close()


@pytest.mark.parametrize("keys", [["id"], ["region", "id"], []])
def test_distribution_columns_form_one_constraint(distribution_source, keys):
    source, connection = distribution_source
    connection.execute.return_value = [(name,) for name in keys]
    unique = TableConstraint(constraintType=ConstraintType.UNIQUE, columns=["id", "region"])

    constraints = source.update_table_constraints(
        table_name="my_table",
        schema_name="my_schema",
        db_name="demo_db",
        table_constraints=[unique],
        foreign_columns=[],
        columns=[Column(name=name, dataType=DataType.INT) for name in ("id", "region")],
    )

    expected = [unique]
    if keys:
        expected.append(TableConstraint(constraintType=ConstraintType.DIST_KEY, columns=keys))
    assert constraints == expected


def test_distribution_lookup_failure_preserves_existing_constraints(distribution_source, caplog):
    source, connection = distribution_source
    connection.execute.side_effect = SQLAlchemyError("catalog unavailable")
    unique = TableConstraint(constraintType=ConstraintType.UNIQUE, columns=["id", "region"])

    constraints = source.update_table_constraints(
        table_name="my_table",
        schema_name="my_schema",
        db_name="demo_db",
        table_constraints=[unique],
        foreign_columns=[],
        columns=[Column(name=name, dataType=DataType.INT) for name in ("id", "region")],
    )

    assert constraints == [unique]
    assert "DIST_KEY" in caplog.text


def test_greenplum_5_preserves_constraints_without_distribution_catalog(distribution_source):
    source, connection = distribution_source
    connection.dialect.server_version_info = (8, 3, 23)
    connection.execute.side_effect = SQLAlchemyError("distribution catalog columns unavailable")
    unique = TableConstraint(constraintType=ConstraintType.UNIQUE, columns=["id", "region"])

    constraints = source.update_table_constraints(
        table_name="my_table",
        schema_name="my_schema",
        db_name="demo_db",
        table_constraints=[unique],
        foreign_columns=[],
        columns=[Column(name=name, dataType=DataType.INT) for name in ("id", "region")],
    )

    assert constraints == [unique]
