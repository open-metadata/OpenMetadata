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
Test athena source
"""

import hashlib
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from pydantic import AnyUrl

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.entity.data.container import (
    Container,
    ContainerDataModel,
    FileFormat,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    Constraint,
    DataType,
    Table,
    TableType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.storageService import StorageServiceType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Href,
    Markdown,
    SourceUrl,
    Timestamp,
    Uuid,
)
from metadata.generated.schema.type.entityLineage import ColumnLineage
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.athena.metadata import AthenaSource
from metadata.ingestion.source.database.athena.models import AthenaStatus
from metadata.ingestion.source.database.athena.usage import AthenaUsageSource
from metadata.ingestion.source.database.common_db_source import TableNameAndType

EXPECTED_DATABASE_NAMES = ["mydatabase"]
MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="2aaa012e-099a-11ed-861d-0242ac120056",
    name="sample_instance",
    fullyQualifiedName="sample_athena_schema.sample_db.sample_instance",
    displayName="default",
    description="",
    database=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)
MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="sample_athena_service",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Glue,
)
MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="sample_db",
    fullyQualifiedName="test_athena.sample_db",
    displayName="sample_db",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)
MOCK_TABLE_NAME = "sample_table"
EXPECTED_DATABASES = [
    Either(
        right=CreateDatabaseRequest(
            name=EntityName("sample_db"),
            service=FullyQualifiedEntityName("sample_athena_service"),
            default=False,
        ),
    )
]
EXPECTED_QUERY_TABLE_NAMES_TYPES = [TableNameAndType(name="sample_table", type_=TableType.External)]
MOCK_LOCATION_ENTITY = [
    Container(
        id=Uuid(UUID("9c489754-bb60-435b-b2a5-0e43100cf950")),
        name=EntityName("dbt-testing/mayur/customers.csv"),
        fullyQualifiedName=FullyQualifiedEntityName('s3_local.awsdatalake-testing."dbt-testing/mayur/customers.csv"'),
        updatedAt=Timestamp(1717070902713),
        updatedBy="admin",
        href=Href(
            root=AnyUrl(
                "http://localhost:8585/api/v1/containers/9c489754-bb60-435b-b2a5-0e43100cf950",
            )
        ),
        service=EntityReference(
            id=Uuid(UUID("dd91cca3-cc54-4776-9efa-48f845cdfb92")),
            type="storageService",
            name="s3_local",
            fullyQualifiedName="s3_local",
            description=Markdown(""),
            displayName="s3_local",
            deleted=False,
            href=Href(
                root=AnyUrl(
                    "http://localhost:8585/api/v1/services/storageServices/dd91cca3-cc54-4776-9efa-48f845cdfb92",
                )
            ),
        ),
        dataModel=ContainerDataModel(
            isPartitioned=False,
            columns=[
                Column(
                    name=ColumnName("CUSTOMERID"),
                    displayName="CUSTOMERID",
                    dataType=DataType.INT,
                    dataTypeDisplay="INT",
                    fullyQualifiedName=FullyQualifiedEntityName(
                        's3_local.awsdatalake-testing."dbt-testing/mayur/customers.csv".CUSTOMERID'
                    ),
                ),
            ],
        ),
        prefix="/dbt-testing/mayur/customers.csv",
        numberOfObjects=2103.0,
        size=652260394.0,
        fileFormats=[FileFormat.csv],
        serviceType=StorageServiceType.S3,
        deleted=False,
        sourceUrl=SourceUrl(
            "https://s3.console.aws.amazon.com/s3/buckets/awsdatalake-testing?region=us-east-2&prefix=dbt-testing/mayur/customers.csv/&showversions=false"
        ),
        fullPath="s3://awsdatalake-testing/dbt-testing/mayur/customers.csv",
        sourceHash="22b1c2f2e7feeaa8f37c6649e01f027d",
    )
]

MOCK_TABLE_ENTITY = [
    Table(
        id=Uuid(UUID("2c040cf8-432d-4597-9517-4794d6142da3")),
        name=EntityName("demo_data_ext_tbl3"),
        fullyQualifiedName=FullyQualifiedEntityName("local_athena.demo.default.demo_data_ext_tbl3"),
        updatedAt=Timestamp(1717071974350),
        updatedBy="admin",
        href=Href(
            root=AnyUrl(
                "http://localhost:8585/api/v1/tables/2c040cf8-432d-4597-9517-4794d6142da3",
            )
        ),
        tableType=TableType.Regular,
        columns=[
            Column(
                name=ColumnName("CUSTOMERID"),
                dataType=DataType.INT,
                dataLength=1,
                dataTypeDisplay="int",
                fullyQualifiedName=FullyQualifiedEntityName("local_athena.demo.default.demo_data_ext_tbl3.CUSTOMERID"),
                constraint=Constraint.NULL,
            ),
        ],
        databaseSchema=EntityReference(
            id=Uuid(UUID("b03b0229-8a9f-497a-a675-74cb24a9be74")),
            type="databaseSchema",
            name="default",
            fullyQualifiedName="local_athena.demo.default",
            displayName="default",
            deleted=False,
            href=Href(
                root=AnyUrl(
                    "http://localhost:8585/api/v1/databaseSchemas/b03b0229-8a9f-497a-a675-74cb24a9be74",
                )
            ),
        ),
        database=EntityReference(
            id=Uuid(UUID("f054c55c-34bf-4c5f-addd-5cc26c7c832a")),
            type="database",
            name="demo",
            fullyQualifiedName="local_athena.demo",
            displayName="demo",
            deleted=False,
            href=Href(
                root=AnyUrl(
                    "http://localhost:8585/api/v1/databases/f054c55c-34bf-4c5f-addd-5cc26c7c832a",
                )
            ),
        ),
        service=EntityReference(
            id=Uuid(UUID("5e98afd3-7257-4c35-a560-f4c25b0f4b97")),
            type="databaseService",
            name="local_athena",
            fullyQualifiedName="local_athena",
            displayName="local_athena",
            deleted=False,
            href=Href(
                root=AnyUrl(
                    "http://localhost:8585/api/v1/services/databaseServices/5e98afd3-7257-4c35-a560-f4c25b0f4b97",
                )
            ),
        ),
        serviceType=DatabaseServiceType.Athena,
        deleted=False,
        sourceHash="824e80b1c79b0c4ae0acd99d2338e149",
    )
]
EXPECTED_COLUMN_LINEAGE = [
    ColumnLineage(
        fromColumns=[
            FullyQualifiedEntityName('s3_local.awsdatalake-testing."dbt-testing/mayur/customers.csv".CUSTOMERID')
        ],
        toColumn=FullyQualifiedEntityName("local_athena.demo.default.demo_data_ext_tbl3.CUSTOMERID"),
    )
]

mock_athena_config = {
    "source": {
        "type": "Athena",
        "serviceName": "test_athena",
        "serviceConnection": {
            "config": {
                "type": "Athena",
                "databaseName": "mydatabase",
                "awsConfig": {
                    "awsAccessKeyId": "dummy",
                    "awsSecretAccessKey": "dummy",
                    "awsRegion": "us-east-2",
                },
                "s3StagingDir": "https://s3-directory-for-datasource.com",
                "workgroup": "workgroup name",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "athena"},
        }
    },
}


class TestAthenaService(unittest.TestCase):
    @patch("metadata.ingestion.source.database.database_service.DatabaseServiceSource.test_connection")
    def __init__(self, methodName, test_connection) -> None:  # noqa: N803
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_athena_config)
        self.athena_source = AthenaSource.create(
            mock_athena_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.athena_source.context.get().__dict__["database_schema"] = MOCK_DATABASE_SCHEMA.name.root
        self.athena_source.context.get().__dict__["database_service"] = MOCK_DATABASE_SERVICE.name.root
        self.athena_source.context.get().__dict__["database"] = MOCK_DATABASE.name.root

    def test_get_database_name(self):
        assert list(self.athena_source.get_database_names()) == EXPECTED_DATABASE_NAMES

    def test_query_table_names_and_types(self):
        mock_glue_client = MagicMock()
        mock_paginator = MagicMock()
        mock_paginator.paginate.return_value = [{"TableList": [{"Name": MOCK_TABLE_NAME, "Parameters": {}}]}]
        mock_glue_client.get_paginator.return_value = mock_paginator
        self.athena_source.glue_client = mock_glue_client
        assert (
            self.athena_source.query_table_names_and_types(MOCK_DATABASE_SCHEMA.name.root)
            == EXPECTED_QUERY_TABLE_NAMES_TYPES
        )

    def test_query_table_names_and_types_iceberg(self):
        mock_glue_client = MagicMock()
        mock_paginator = MagicMock()
        mock_paginator.paginate.return_value = [
            {
                "TableList": [
                    {
                        "Name": MOCK_TABLE_NAME,
                        "Parameters": {"table_type": "ICEBERG"},
                    }
                ]
            }
        ]
        mock_glue_client.get_paginator.return_value = mock_paginator
        self.athena_source.glue_client = mock_glue_client
        assert self.athena_source.query_table_names_and_types(MOCK_DATABASE_SCHEMA.name.root) == [
            TableNameAndType(name=MOCK_TABLE_NAME, type_=TableType.Iceberg)
        ]

    def test_yield_database(self):
        assert list(self.athena_source.yield_database(database_name=MOCK_DATABASE.name.root)) == EXPECTED_DATABASES

    def test_column_lineage(self):
        columns_list = [column.name.root for column in MOCK_TABLE_ENTITY[0].columns]
        column_lineage = self.athena_source._get_column_lineage(
            MOCK_LOCATION_ENTITY[0].dataModel, MOCK_TABLE_ENTITY[0], columns_list
        )
        assert column_lineage == EXPECTED_COLUMN_LINEAGE


SUBMISSION_DT = datetime(2024, 1, 2, 10, 0, 0)
COMPLETION_DT = datetime(2024, 1, 2, 10, 5, 0)


class TestAthenaUsageYieldTableQueries:
    def _make_source(self):
        source = MagicMock()
        source.dialect.value = "athena"
        source.config.serviceName = "test_athena"
        source.start = datetime(2024, 1, 1)
        source.is_not_dbt_or_om_query.return_value = True
        return source

    def _make_query_list(self, status):
        query = MagicMock()
        query.Query = "SELECT 1"
        query.Status = status
        query.Statistics = None
        query_list = MagicMock()
        query_list.QueryExecutions = [query]
        return query_list

    def test_end_time_uses_completion_datetime_when_present(self):
        status = MagicMock()
        status.State = "SUCCEEDED"
        status.SubmissionDateTime = SUBMISSION_DT
        status.CompletionDateTime = COMPLETION_DT

        source = self._make_source()
        source.get_queries.return_value = [self._make_query_list(status)]

        results = list(AthenaUsageSource.yield_table_queries(source))

        assert len(results) == 1
        assert len(results[0].queries) == 1
        assert results[0].queries[0].endTime == COMPLETION_DT.isoformat(" ", "seconds")

    def test_end_time_falls_back_to_submission_when_completion_missing(self):
        status = AthenaStatus(State="SUCCEEDED", SubmissionDateTime=SUBMISSION_DT)

        source = self._make_source()
        source.get_queries.return_value = [self._make_query_list(status)]

        results = list(AthenaUsageSource.yield_table_queries(source))

        assert len(results) == 1
        assert len(results[0].queries) == 1
        assert results[0].queries[0].endTime == SUBMISSION_DT.isoformat(" ", "seconds")


@pytest.fixture
def athena_source():
    """A minimally-wired AthenaSource with context populated and a dummy type ref."""
    from metadata.generated.schema.type.customProperty import PropertyType

    config = OpenMetadataWorkflowConfig.model_validate(mock_athena_config)
    with patch(
        "metadata.ingestion.source.database.database_service.DatabaseServiceSource.test_connection",
        return_value=False,
    ):
        source = AthenaSource.create(
            mock_athena_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )

    source.context.get().__dict__["database_schema"] = MOCK_DATABASE_SCHEMA.name.root
    source.context.get().__dict__["database_service"] = MOCK_DATABASE_SERVICE.name.root
    source.context.get().__dict__["database"] = MOCK_DATABASE.name.root
    source._string_property_type_ref = PropertyType(
        EntityReference(id=UUID("00000000-0000-0000-0000-000000000001"), type="type")
    )
    source.source_config.includeCustomProperties = True
    return source


def _mock_query_rows(source, rows):
    """Wire source.engine.connect() as a context manager yielding the given rows."""
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value.execute.return_value = rows
    source.engine = mock_engine
    return mock_engine


def _get_request(mock_metadata, call_index=0):
    """Pull the CreateCustomPropertyRequest from a create_or_update_custom_property call."""
    return mock_metadata.create_or_update_custom_property.call_args_list[call_index].args[0].createCustomPropertyRequest


class TestGetTableExtensionsEarlyExits:
    """Cover the early-return branches of get_table_extensions."""

    def test_returns_none_when_include_custom_properties_disabled(self, athena_source):
        athena_source.source_config.includeCustomProperties = False
        with patch.object(athena_source, "_fetch_iceberg_properties") as mock_fetch:
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)
        assert result is None
        mock_fetch.assert_not_called()

    def test_returns_none_without_type_ref(self, athena_source):
        athena_source._string_property_type_ref = None
        assert athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg) is None

    def test_returns_none_for_external_table(self, athena_source):
        assert athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.External) is None

    def test_returns_none_for_regular_table(self, athena_source):
        assert athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Regular) is None

    def test_returns_none_when_table_type_is_none(self, athena_source):
        assert athena_source.get_table_extensions(MOCK_TABLE_NAME) is None

    def test_returns_none_when_query_yields_no_properties(self, athena_source):
        with patch.object(athena_source, "_fetch_iceberg_properties", return_value={}):
            assert athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg) is None

    def test_returns_none_when_all_values_filtered_out(self, athena_source):
        props = {"k1": None, "k2": ""}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata"),
        ):
            assert athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg) is None


class TestGetTableExtensionsSanitization:
    """Property name sanitization and display-name preservation."""

    def test_dot_is_preserved(self, athena_source):
        props = {"myprop.owner": "team-a"}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata") as mock_metadata,
        ):
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)

        assert result == {"myprop.owner": "team-a"}
        request = _get_request(mock_metadata)
        assert request.name.root == "myprop.owner"
        assert request.displayName == "myprop.owner"

    def test_hyphen_is_preserved(self, athena_source):
        props = {"myprop-owner": "x"}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata") as mock_metadata,
        ):
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)

        assert result == {"myprop-owner": "x"}
        request = _get_request(mock_metadata)
        assert request.name.root == "myprop-owner"

    def test_allowed_punctuation_combined_preserved(self, athena_source):
        """Dots and hyphens together are allowed — name passes through untouched."""
        props = {"myprop.airflow-dag-id": "scrape-dag"}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata") as mock_metadata,
        ):
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)

        assert result == {"myprop.airflow-dag-id": "scrape-dag"}
        request = _get_request(mock_metadata)
        assert request.name.root == "myprop.airflow-dag-id"
        assert request.displayName == "myprop.airflow-dag-id"

    def test_other_special_chars_still_replaced(self, athena_source):
        """Everything outside [A-Za-z0-9_.-] gets replaced with __."""
        props = {"myprop/airflow:dag id@prod": "v"}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata") as mock_metadata,
        ):
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)

        assert result == {"myprop__airflow__dag__id__prod": "v"}
        request = _get_request(mock_metadata)
        assert request.displayName == "myprop/airflow:dag id@prod"

    def test_mixed_allowed_and_disallowed_chars(self, athena_source):
        """Allowed chars (. -) stay; disallowed chars (/ space) get replaced."""
        props = {"myprop.data/type-v1 beta": "v"}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata"),
        ):
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)

        assert result == {"myprop.data__type-v1__beta": "v"}

    def test_already_valid_name_unchanged(self, athena_source):
        props = {"simple_key": "value"}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata") as mock_metadata,
        ):
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)

        assert result == {"simple_key": "value"}
        request = _get_request(mock_metadata)
        assert request.name.root == "simple_key"
        assert request.displayName == "simple_key"

    def test_alphanumeric_and_underscore_preserved(self, athena_source):
        props = {"abc123_XYZ": "v"}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata"),
        ):
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)
        assert result == {"abc123_XYZ": "v"}

    def test_sanitized_name_at_256_chars_not_hashed(self, athena_source):
        name = "a" * 256
        props = {name: "value"}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata") as mock_metadata,
        ):
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)

        assert result == {name: "value"}
        request = _get_request(mock_metadata)
        assert request.displayName == name

    def test_long_sanitized_name_is_md5_hashed(self, athena_source):
        original = "myprop." + ("a" * 260)
        props = {original: "value"}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata") as mock_metadata,
        ):
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)

        expected_hash = hashlib.md5(original.encode("utf-8"), usedforsecurity=False).hexdigest()
        assert result == {expected_hash: "value"}
        request = _get_request(mock_metadata)
        assert request.name.root == expected_hash
        assert request.displayName == original

    def test_hashed_name_is_stable_for_same_input(self, athena_source):
        """Same long original name must always map to the same hash."""
        original = "x." + ("b" * 300)
        props_first = {original: "v1"}
        props_second = {original: "v2"}

        with (
            patch.object(
                athena_source,
                "_fetch_iceberg_properties",
                side_effect=[props_first, props_second],
            ),
            patch.object(athena_source, "metadata"),
        ):
            r1 = athena_source.get_table_extensions("t1", TableType.Iceberg)
            r2 = athena_source.get_table_extensions("t2", TableType.Iceberg)

        assert list(r1.keys()) == list(r2.keys())


class TestGetTableExtensionsValueFiltering:
    """Filter out null and empty-string property values."""

    def test_skips_none_valued_property(self, athena_source):
        props = {"k1": "v1", "k2": None}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata") as mock_metadata,
        ):
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)

        assert result == {"k1": "v1"}
        assert mock_metadata.create_or_update_custom_property.call_count == 1

    def test_skips_empty_string_valued_property(self, athena_source):
        props = {"k1": "v1", "k2": ""}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata"),
        ):
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)
        assert result == {"k1": "v1"}

    def test_keeps_string_zero(self, athena_source):
        """'0' is falsy-ish in some checks but is a legitimate value."""
        props = {"k": "0"}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata"),
        ):
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)
        assert result == {"k": "0"}

    def test_keeps_whitespace_value(self, athena_source):
        """A single space is not an empty string and should pass through."""
        props = {"k": " "}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata"),
        ):
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)
        assert result == {"k": " "}


class TestGetTableExtensionsDedup:
    """_processed_prop prevents redundant custom-property registration."""

    def test_same_prop_across_tables_registered_once(self, athena_source):
        props = {"shared_key": "v"}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata") as mock_metadata,
        ):
            athena_source.get_table_extensions("tbl1", TableType.Iceberg)
            athena_source.get_table_extensions("tbl2", TableType.Iceberg)

        assert mock_metadata.create_or_update_custom_property.call_count == 1
        assert "shared_key" in athena_source._processed_prop

    def test_distinct_props_each_registered_once(self, athena_source):
        with (
            patch.object(
                athena_source,
                "_fetch_iceberg_properties",
                side_effect=[{"k1": "a"}, {"k2": "b"}],
            ),
            patch.object(athena_source, "metadata") as mock_metadata,
        ):
            athena_source.get_table_extensions("tbl1", TableType.Iceberg)
            athena_source.get_table_extensions("tbl2", TableType.Iceberg)

        assert mock_metadata.create_or_update_custom_property.call_count == 2

    def test_registration_failure_does_not_mark_prop_processed(self, athena_source):
        """A failed registration must not be cached — so a retry on the next table can succeed."""
        props = {"k1": "v1"}
        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata") as mock_metadata,
        ):
            mock_metadata.create_or_update_custom_property.side_effect = Exception("boom")
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)

        assert result is None
        assert "k1" not in athena_source._processed_prop

    def test_registration_failure_for_one_prop_does_not_block_others(self, athena_source):
        """Registration errors on one prop don't prevent others from being returned."""
        props = {"bad_prop": "x", "good_prop": "y"}
        call_flag = {"first": True}

        def side_effect(_):
            if call_flag["first"]:
                call_flag["first"] = False
                raise Exception("boom")
            return None

        with (
            patch.object(athena_source, "_fetch_iceberg_properties", return_value=props),
            patch.object(athena_source, "metadata") as mock_metadata,
        ):
            mock_metadata.create_or_update_custom_property.side_effect = side_effect
            result = athena_source.get_table_extensions(MOCK_TABLE_NAME, TableType.Iceberg)

        assert result == {"good_prop": "y"}


class TestFetchIcebergProperties:
    """Unit tests for the $properties query helper."""

    def test_returns_properties_from_query(self, athena_source):
        _mock_query_rows(
            athena_source,
            [("myprop.owner", "team-a"), ("myprop.source", "ex")],
        )

        result = athena_source._fetch_iceberg_properties(MOCK_DATABASE_SCHEMA.name.root, MOCK_TABLE_NAME)
        assert result == {"myprop.owner": "team-a", "myprop.source": "ex"}

    def test_returns_empty_dict_on_exception(self, athena_source):
        mock_engine = MagicMock()
        mock_engine.connect.side_effect = Exception("connection refused")
        athena_source.engine = mock_engine

        result = athena_source._fetch_iceberg_properties(MOCK_DATABASE_SCHEMA.name.root, MOCK_TABLE_NAME)
        assert result == {}

    def test_filters_null_key_and_null_value_rows(self, athena_source):
        _mock_query_rows(
            athena_source,
            [
                ("k1", "v1"),
                (None, "no_key"),
                ("k2", None),
                ("k3", "v3"),
            ],
        )

        result = athena_source._fetch_iceberg_properties(MOCK_DATABASE_SCHEMA.name.root, MOCK_TABLE_NAME)
        assert result == {"k1": "v1", "k3": "v3"}

    def test_query_targets_dollar_properties_metatable(self, athena_source):
        mock_engine = _mock_query_rows(athena_source, [])

        athena_source._fetch_iceberg_properties("my_schema", "my_table")

        execute_call = mock_engine.connect.return_value.__enter__.return_value.execute
        executed_sql = str(execute_call.call_args.args[0])
        assert "my_schema" in executed_sql
        assert "my_table$properties" in executed_sql
        assert "key" in executed_sql
        assert "value" in executed_sql

    def test_values_are_coerced_to_string(self, athena_source):
        _mock_query_rows(athena_source, [("k_int", 42), ("k_bool", True)])

        result = athena_source._fetch_iceberg_properties(MOCK_DATABASE_SCHEMA.name.root, MOCK_TABLE_NAME)
        assert result == {"k_int": "42", "k_bool": "True"}


class TestQueryTableNamesAndTypesIcebergConstant:
    """Iceberg detection uses the shared ICEBERG_TABLE_TYPE constant."""

    def test_constant_value_matches_glue_parameter(self):
        from metadata.ingestion.source.database.athena.metadata import (
            ICEBERG_TABLE_TYPE,
        )

        assert ICEBERG_TABLE_TYPE == "ICEBERG"


class TestIncludeCustomPropertiesSchema:
    """The includeCustomProperties config flag defaults to False."""

    def test_default_is_false(self):
        from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
            DatabaseServiceMetadataPipeline,
        )

        pipeline = DatabaseServiceMetadataPipeline()
        assert pipeline.includeCustomProperties is False

    def test_can_be_enabled(self):
        from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
            DatabaseServiceMetadataPipeline,
        )

        pipeline = DatabaseServiceMetadataPipeline(includeCustomProperties=True)
        assert pipeline.includeCustomProperties is True
