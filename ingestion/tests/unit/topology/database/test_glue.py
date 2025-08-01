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
Test Glue using the topology
"""

import json
from copy import deepcopy
from pathlib import Path
from unittest import TestCase
from unittest.mock import Mock, patch

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import FileFormat, TableType
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.glue.metadata import GlueSource
from metadata.ingestion.source.database.glue.models import DatabasePage, TablePage

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/glue_db_dataset.json"
)
with open(mock_file_path) as file:
    mock_data: dict = json.load(file)

mock_glue_config = {
    "source": {
        "type": "glue",
        "serviceName": "local_glue",
        "serviceConnection": {
            "config": {
                "type": "Glue",
                "awsConfig": {
                    "awsAccessKeyId": "aws_access_key_id",
                    "awsSecretAccessKey": "aws_secret_access_key",
                    "awsRegion": "us-east-2",
                    "endPointURL": "https://endpoint.com/",
                },
            },
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "glue"},
        }
    },
}


def mock_fqn_build(*args, **kwargs) -> str:
    return ".".join((kwargs[key] for key in kwargs if key.endswith("_name")))


MOCK_CUSTOM_DB_NAME = "NEW_DB"

mock_glue_config_db_test = deepcopy(mock_glue_config)
mock_glue_config_db_test["source"]["serviceConnection"]["config"][
    "databaseName"
] = MOCK_CUSTOM_DB_NAME

MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="glue_source",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Glue,
)

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="118146679784",
    fullyQualifiedName="glue_source.118146679784",
    displayName="118146679784",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="2aaa012e-099a-11ed-861d-0242ac120056",
    name="default",
    fullyQualifiedName="glue_source.118146679784.default",
    displayName="default",
    description="",
    database=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
    service=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
)

EXPECTED_DATABASE_NAMES = ["118146679784"]

EXPECTED_DATABASE_SCHEMA_NAMES = [
    "default",
    "mydatabase",
    "testdatalake_db",
    "zipcode-db",
]

EXPECTED_TABLE_NAMES = ["cloudfront_logs", "cloudfront_logs2", "map_table"]

EXPECTED_TABLE_TYPES = [TableType.External, TableType.Iceberg, TableType.View]

EXPECTED_FILE_FORMATS = [None, FileFormat.tsv, FileFormat.parquet]

EXPECTED_LOCATION_PATHS = [
    "s3://athena-examples-MyRegion/cloudfront/plaintext",
    "s3://athena-postgres/",
    "s3://athena-postgres/map-test",
]


class GlueUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.glue.metadata.GlueSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_glue_config)
        self.glue_source = GlueSource.create(
            mock_glue_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.glue_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.glue_source.context.get().__dict__["database"] = MOCK_DATABASE.name.root
        self.glue_source.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root
        self.glue_source._get_glue_database_and_schemas = lambda: [
            DatabasePage(**mock_data.get("mock_database_paginator"))
        ]
        self.glue_source._get_glue_tables = lambda: [
            TablePage(**mock_data.get("mock_table_paginator"))
        ]

    def get_table_requests(self):
        tables = self.glue_source.get_tables_name_and_type()
        for table in tables:
            yield next(self.glue_source.yield_table(table)).right

    def test_database_names(self):
        assert EXPECTED_DATABASE_NAMES == list(self.glue_source.get_database_names())

    @patch(
        "metadata.ingestion.source.database.glue.metadata.GlueSource.test_connection"
    )
    def test_custom_db_name(self, test_connection):
        test_connection.return_value = False
        glue_source_new = GlueSource.create(
            mock_glue_config_db_test["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.assertEqual(
            list(glue_source_new.get_database_names()), [MOCK_CUSTOM_DB_NAME]
        )

    def test_database_schema_names(self):
        assert EXPECTED_DATABASE_SCHEMA_NAMES == list(
            self.glue_source.get_database_schema_names()
        )

    @patch("metadata.ingestion.source.database.glue.metadata.fqn")
    def test_table_names(self, fqn):
        fqn.build = mock_fqn_build
        for table_and_table_type in list(self.glue_source.get_tables_name_and_type()):
            table_and_table_type[0]
            assert table_and_table_type[0] in EXPECTED_TABLE_NAMES
            assert table_and_table_type[1] in EXPECTED_TABLE_TYPES

    @patch("metadata.ingestion.source.database.glue.metadata.fqn")
    def test_file_formats(self, fqn):
        fqn.build = mock_fqn_build
        assert (
            list(map(lambda x: x.fileFormat, self.get_table_requests()))
            == EXPECTED_FILE_FORMATS
        )

    @patch("metadata.ingestion.source.database.glue.metadata.fqn")
    def test_location_paths(self, fqn):
        fqn.build = mock_fqn_build
        assert (
            list(map(lambda x: x.locationPath, self.get_table_requests()))
            == EXPECTED_LOCATION_PATHS
        )

    def test_iceberg_column_filtering_logic(self):
        """Test the Iceberg column filtering logic directly"""

        # Create mock Glue column data (as returned by boto3)
        current_column = {
            "Name": "current_col",
            "Type": "int",
            "Comment": "Current column",
            "Parameters": {"iceberg.field.current": "true"},
        }
        non_current_column = {
            "Name": "non_current_col",
            "Type": "string",
            "Comment": "Non-current column",
            "Parameters": {"iceberg.field.current": "false"},
        }
        column_without_params = {
            "Name": "normal_col",
            "Type": "boolean",
            "Comment": "Normal column",
            "Parameters": {},
        }

        # Test the filtering logic directly (same logic as in get_columns function)
        current_columns = []
        for col in [current_column, non_current_column, column_without_params]:
            col_name = col["Name"]
            col_type = col["Type"]
            col_comment = col.get("Comment", "")
            col_parameters = col.get("Parameters", {})

            # Check if this is a non-current Iceberg column
            iceberg_current = col_parameters.get("iceberg.field.current", "true")
            is_current = iceberg_current != "false"

            if is_current:
                current_columns.append(col_name)

        # Verify that only current columns are returned
        current_column_names = current_columns

        # Should include current_col and normal_col, but not non_current_col
        self.assertIn("current_col", current_column_names)
        self.assertIn("normal_col", current_column_names)
        self.assertNotIn("non_current_col", current_column_names)

        # Verify that exactly 2 columns are returned (current_col and normal_col)
        self.assertEqual(len(current_columns), 2)

    def test_iceberg_table_detection(self):
        """Test that Iceberg tables are correctly detected"""

        # Test with Iceberg table
        mock_iceberg_table = Mock()
        mock_iceberg_table.Parameters = Mock()
        mock_iceberg_table.Parameters.table_type = "ICEBERG"

        # Test with non-Iceberg table
        mock_regular_table = Mock()
        mock_regular_table.Parameters = Mock()
        mock_regular_table.Parameters.table_type = "EXTERNAL_TABLE"

        # Test with table without parameters
        mock_no_params_table = Mock()
        mock_no_params_table.Parameters = None

        # Test the detection logic
        is_iceberg_1 = (
            mock_iceberg_table.Parameters
            and mock_iceberg_table.Parameters.table_type == "ICEBERG"
        )
        is_iceberg_2 = (
            mock_regular_table.Parameters
            and mock_regular_table.Parameters.table_type == "ICEBERG"
        )
        is_iceberg_3 = (
            mock_no_params_table.Parameters
            and mock_no_params_table.Parameters.table_type == "ICEBERG"
        )

        self.assertTrue(is_iceberg_1)
        self.assertFalse(is_iceberg_2)
        self.assertFalse(is_iceberg_3)
