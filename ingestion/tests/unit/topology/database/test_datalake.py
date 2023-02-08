from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.datalake.metadata import DatalakeSource
from metadata.ingestion.source.database.datalake.utils import (
    read_from_avro,
    read_from_json,
)

mock_datalake_config = {
    "source": {
        "type": "datalake",
        "serviceName": "local_datalake",
        "serviceConnection": {
            "config": {
                "type": "Datalake",
                "configSource": {
                    "securityConfig": {
                        "awsAccessKeyId": "aws_access_key_id",
                        "awsSecretAccessKey": "aws_secret_access_key",
                        "awsRegion": "us-east-2",
                        "endPointURL": "https://endpoint.com/",
                    }
                },
                "bucketName": "bucket name",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
                "schemaFilterPattern": {
                    "excludes": [
                        "^test.*",
                        ".*test$",
                    ]
                },
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

MOCK_S3_SCHEMA = {
    "Buckets": [
        {"Name": "test_datalake"},
        {"Name": "test_gcs"},
        {"Name": "s3_test"},
        {"Name": "my_bucket"},
    ]
}

MOCK_GCS_SCHEMA = [
    SimpleNamespace(name="test_datalake"),
    SimpleNamespace(name="test_gcs"),
    SimpleNamespace(name="s3_test"),
    SimpleNamespace(name="my_bucket"),
]

EXPECTED_SCHEMA = ["my_bucket"]


MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="local_datalake",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Postgres,
)

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="118146679784",
    fullyQualifiedName="local_datalake.default",
    displayName="118146679784",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)

EXAMPLE_JSON_TEST_1 = """
{"name":"John","age":16,"sex":"M"}
{"name":"Milan","age":19,"sex":"M"}
"""

EXAMPLE_JSON_TEST_2 = """
{"name":"John","age":16,"sex":"M"}
"""

EXPECTED_AVRO_COL_1 = [
    Column(name="uid", dataType="INT", dataTypeDisplay="int"),
    Column(name="somefield", dataType="STRING", dataTypeDisplay="string"),
    Column(
        name="options",
        dataType="ARRAY",
        dataTypeDisplay="array<record>",
        arrayDataType="RECORD",
        children=[
            Column(
                name="lvl2_record",
                dataTypeDisplay="record",
                dataType="RECORD",
                children=[
                    Column(
                        name="item1_lvl2", dataType="STRING", dataTypeDisplay="string"
                    ),
                    Column(
                        name="item2_lvl2",
                        dataType="ARRAY",
                        arrayDataType="RECORD",
                        dataTypeDisplay="array<record>",
                        children=[
                            Column(
                                name="lvl3_record",
                                dataType="RECORD",
                                dataTypeDisplay="record",
                                children=[
                                    Column(
                                        name="item1_lvl3",
                                        dataType="STRING",
                                        dataTypeDisplay="string",
                                    ),
                                    Column(
                                        name="item2_lvl3",
                                        dataType="STRING",
                                        dataTypeDisplay="string",
                                    ),
                                ],
                            ),
                        ],
                    ),
                ],
            )
        ],
    ),
]


EXPECTED_AVRO_COL_2 = [
    Column(
        name="username",
        dataType="STRING",
        dataTypeDisplay="string",
    ),
    Column(
        name="tweet",
        dataType="STRING",
        dataTypeDisplay="string",
    ),
    Column(
        name="timestamp",
        dataType="LONG",
        dataTypeDisplay="long",
    ),
]

avro_schema_data_1 = (
    Path(__file__).parent.parent.parent / "resources/datasets/avro_schema_file.avro"
)
with open(avro_schema_data_1, encoding="utf-8") as file:
    avro_schema_data_1 = file.buffer.read()


avro_schema_data_2 = (
    Path(__file__).parent.parent.parent / "resources/datasets/avro_data_file.avro"
)
with open(avro_schema_data_2, encoding="utf-8") as file:
    avro_schema_data_2 = file.buffer.read()


def _get_str_value(data):
    if data:
        if isinstance(data, str):
            return data
        return data.value


def custom_column_compare(self, other):
    return (
        self.name == other.name
        and self.dataTypeDisplay == other.dataTypeDisplay
        and self.children == other.children
        and _get_str_value(self.arrayDataType) == _get_str_value(other.arrayDataType)
    )


class DatalakeUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.datalake.metadata.DatalakeSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_datalake_config)
        self.datalake_source = DatalakeSource.create(
            mock_datalake_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.datalake_source.context.__dict__["database"] = MOCK_DATABASE
        self.datalake_source.context.__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE

    def test_s3_schema_filer(self):
        self.datalake_source.client.list_buckets = lambda: MOCK_S3_SCHEMA
        assert list(self.datalake_source.fetch_s3_bucket_names()) == EXPECTED_SCHEMA

    def test_gcs_schema_filer(self):
        self.datalake_source.client.list_buckets = lambda: MOCK_GCS_SCHEMA
        assert list(self.datalake_source.fetch_gcs_bucket_names()) == EXPECTED_SCHEMA

    def test_json_file_parse(self):
        import pandas as pd

        sample_dict = {"name": "John", "age": 16, "sex": "M"}

        EXPECTED_DF_1 = pd.DataFrame.from_dict(
            [
                {"name": "John", "age": 16, "sex": "M"},
                {"name": "Milan", "age": 19, "sex": "M"},
            ]
        )
        EXPECTED_DF_2 = pd.DataFrame.from_dict(
            {key: pd.Series(value) for key, value in sample_dict.items()}
        )

        actual_df_1 = read_from_json(key="file.json", json_text=EXAMPLE_JSON_TEST_1)[0]
        actual_df_2 = read_from_json(key="file.json", json_text=EXAMPLE_JSON_TEST_2)[0]

        assert actual_df_1.compare(EXPECTED_DF_1).empty
        assert actual_df_2.compare(EXPECTED_DF_2).empty

    def test_avro_file_parse(self):
        columns = read_from_avro(avro_schema_data_1)
        Column.__eq__ = custom_column_compare

        assert EXPECTED_AVRO_COL_1 == columns.columns

        columns = read_from_avro(avro_schema_data_2)
        assert EXPECTED_AVRO_COL_2 == columns.columns
