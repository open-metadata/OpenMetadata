# pylint: disable=line-too-long
#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Unit tests for datalake source
"""

from copy import deepcopy
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

EXAMPLE_JSON_TEST_3 = """
{
    "name":"John",
    "age":16,
    "sex":"M",
    "address":{
        "city":"Mumbai",
        "state":"Maharashtra",
        "country":"India",
        "coordinates":{
            "lat":123,
            "lon":123
        }
    }
}
"""

EXAMPLE_JSON_TEST_4 = """
[
    {"name":"John","age":16,"sex":"M"},
    {
        "name":"John",
        "age":16,
        "sex":"M",
        "address":{
            "city":"Mumbai",
            "state":"Maharashtra",
            "country":"India",
            "coordinates":{
                "lat":123,
                "lon":123
            }
        }
    }
]
"""

EXAMPLE_JSON_COL_3 = [
    Column(
        name="name",
        dataType="STRING",
        dataTypeDisplay="STRING",
    ),
    Column(
        name="age",
        dataType="INT",
        dataTypeDisplay="INT",
    ),
    Column(
        name="sex",
        dataType="STRING",
        dataTypeDisplay="STRING",
    ),
    Column(
        name="address",
        dataType="RECORD",
        dataTypeDisplay="RECORD",
        children=[
            Column(
                name="city",
                dataType="STRING",
                dataTypeDisplay="STRING",
            ),
            Column(
                name="state",
                dataType="STRING",
                dataTypeDisplay="STRING",
            ),
            Column(
                name="country",
                dataType="STRING",
                dataTypeDisplay="STRING",
            ),
            Column(
                name="coordinates",
                dataType="RECORD",
                dataTypeDisplay="RECORD",
                children=[
                    Column(
                        name="lat",
                        dataType="INT",
                        dataTypeDisplay="INT",
                    ),
                    Column(
                        name="lon",
                        dataType="INT",
                        dataTypeDisplay="INT",
                    ),
                ],
            ),
        ],
    ),
]


EXAMPLE_JSON_COL_4 = deepcopy(EXAMPLE_JSON_COL_3)
EXAMPLE_JSON_COL_4[3].children[3].children = [
    Column(
        name="lat",
        dataType="FLOAT",
        dataTypeDisplay="FLOAT",
    ),
    Column(
        name="lon",
        dataType="FLOAT",
        dataTypeDisplay="FLOAT",
    ),
]

EXPECTED_AVRO_COL_1 = [
    Column(
        name="level",
        dataType="RECORD",
        children=[
            Column(name="uid", dataType="INT", dataTypeDisplay="int"),
            Column(name="somefield", dataType="STRING", dataTypeDisplay="string"),
            Column(
                name="options",
                dataType="ARRAY",
                dataTypeDisplay="ARRAY<record>",
                arrayDataType="RECORD",
                children=[
                    Column(
                        name="lvl2_record",
                        dataType="RECORD",
                        children=[
                            Column(
                                name="item1_lvl2",
                                dataType="STRING",
                                dataTypeDisplay="string",
                            ),
                            Column(
                                name="item2_lvl2",
                                dataType="ARRAY",
                                arrayDataType="RECORD",
                                dataTypeDisplay="ARRAY<record>",
                                children=[
                                    Column(
                                        name="lvl3_record",
                                        dataType="RECORD",
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
        ],
    )
]


EXPECTED_AVRO_COL_2 = [
    Column(
        name="twitter_schema",
        dataType="RECORD",
        children=[
            Column(
                name="username",
                dataType="STRING",
                description="Name of the user account on Twitter.com",
                dataTypeDisplay="string",
            ),
            Column(
                name="tweet",
                dataType="STRING",
                dataTypeDisplay="string",
                description="The content of the user's Twitter message",
            ),
            Column(
                name="timestamp",
                dataType="LONG",
                dataTypeDisplay="long",
                description="Unix epoch time in seconds",
            ),
        ],
    )
]

AVRO_SCHEMA_FILE = b"""{
    "namespace": "openmetadata.kafka",
    "name": "level",
    "type": "record",
    "fields": [
        {
            "name": "uid",
            "type": "int"
        },
        {
            "name": "somefield",
            "type": "string"
        },
        {
            "name": "options",
            "type": {
                "type": "array",
                "items": {
                    "type": "record",
                    "name": "lvl2_record",
                    "fields": [
                        {
                            "name": "item1_lvl2",
                            "type": "string"
                        },
                        {
                            "name": "item2_lvl2",
                            "type": {
                                "type": "array",
                                "items": {
                                    "type": "record",
                                    "name": "lvl3_record",
                                    "fields": [
                                        {
                                            "name": "item1_lvl3",
                                            "type": "string"
                                        },
                                        {
                                            "name": "item2_lvl3",
                                            "type": "string"
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
            }
        }
    ]
}"""

AVRO_DATA_FILE = b'Obj\x01\x04\x16avro.schema\xe8\x05{"type":"record","name":"twitter_schema","namespace":"com.miguno.avro","fields":[{"name":"username","type":"string","doc":"Name of the user account on Twitter.com"},{"name":"tweet","type":"string","doc":"The content of the user\'s Twitter message"},{"name":"timestamp","type":"long","doc":"Unix epoch time in seconds"}],"doc:":"A basic schema for storing Twitter messages"}\x14avro.codec\x08null\x00g\xc75)s\xef\xdf\x94\xad\xd3\x00~\x9e\xeb\xff\xae\x04\xc8\x01\x0cmigunoFRock: Nerf paper, scissors is fine.\xb2\xb8\xee\x96\n\x14BlizzardCSFWorks as intended.  Terran is IMBA.\xe2\xf3\xee\x96\ng\xc75)s\xef\xdf\x94\xad\xd3\x00~\x9e\xeb\xff\xae'


def _get_str_value(data):
    if data:
        if isinstance(data, str):
            return data
        return data.value

    return None


def custom_column_compare(self, other):
    return (
        self.name == other.name
        and self.description == other.description
        and self.dataTypeDisplay == other.dataTypeDisplay
        and self.children == other.children
        and _get_str_value(self.arrayDataType) == _get_str_value(other.arrayDataType)
    )


class DatalakeUnitTest(TestCase):
    """
    Datalake Source Unit Teststest_datalake.py:249
    """

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
        """
        Test json data files
        """
        import pandas as pd  # pylint: disable=import-outside-toplevel

        sample_dict = {"name": "John", "age": 16, "sex": "M"}

        exp_df_list = pd.json_normalize(
            [
                {"name": "John", "age": 16, "sex": "M"},
                {"name": "Milan", "age": 19, "sex": "M"},
            ]
        )
        exp_df_obj = pd.json_normalize(sample_dict)

        actual_df_1 = read_from_json(key="file.json", json_text=EXAMPLE_JSON_TEST_1)[0]
        actual_df_2 = read_from_json(key="file.json", json_text=EXAMPLE_JSON_TEST_2)[0]

        assert actual_df_1.compare(exp_df_list).empty
        assert actual_df_2.compare(exp_df_obj).empty

        actual_df_3 = read_from_json(key="file.json", json_text=EXAMPLE_JSON_TEST_3)[0]
        actual_cols_3 = DatalakeSource.get_columns(actual_df_3)
        self.assertEqual(actual_cols_3, EXAMPLE_JSON_COL_3)

        actual_df_4 = read_from_json(key="file.json", json_text=EXAMPLE_JSON_TEST_4)[0]
        actual_cols_4 = DatalakeSource.get_columns(actual_df_4)
        self.assertEqual(actual_cols_4, EXAMPLE_JSON_COL_4)

    def test_avro_file_parse(self):
        columns = read_from_avro(AVRO_SCHEMA_FILE)
        Column.__eq__ = custom_column_compare

        assert EXPECTED_AVRO_COL_1 == columns.columns  # pylint: disable=no-member

        columns = read_from_avro(AVRO_DATA_FILE)
        assert EXPECTED_AVRO_COL_2 == columns.columns  # pylint: disable=no-member
