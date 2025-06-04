# pylint: disable=line-too-long
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
from metadata.readers.dataframe.avro import AvroDataFrameReader
from metadata.readers.dataframe.json import JSONDataFrameReader
from metadata.utils.datalake.datalake_utils import (
    GenericDataFrameColumnParser,
    JsonDataFrameColumnParser,
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
                "bucketName": "my_bucket",
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
            "securityConfig": {"jwtToken": "datalake"},
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
EXPECTED_GCS_SCHEMA = ["my_bucket"]


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

EXAMPLE_JSON_TEST_1 = b"""
{"name":"John","age":16,"sex":"M"}
{"name":"Milan","age":19,"sex":"M"}
"""

EXAMPLE_JSON_TEST_2 = b"""
{"name":"John","age":16,"sex":"M"}
"""

EXAMPLE_JSON_TEST_3 = b"""
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

EXAMPLE_JSON_TEST_4 = b"""
[
    {"name":"John","age":16,"sex":"M","address":null},
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
        displayName="name",
    ),
    Column(
        name="age",
        dataType="INT",
        dataTypeDisplay="INT",
        displayName="age",
    ),
    Column(
        name="sex",
        dataType="STRING",
        dataTypeDisplay="STRING",
        displayName="sex",
    ),
    Column(
        name="address",
        dataType="JSON",
        dataTypeDisplay="JSON",
        displayName="address",
        children=[
            Column(
                name="city",
                dataType="STRING",
                dataTypeDisplay="STRING",
                displayName="city",
            ),
            Column(
                name="state",
                dataType="STRING",
                dataTypeDisplay="STRING",
                displayName="state",
            ),
            Column(
                name="country",
                dataType="STRING",
                dataTypeDisplay="STRING",
                displayName="country",
            ),
            Column(
                name="coordinates",
                dataType="JSON",
                dataTypeDisplay="JSON",
                displayName="coordinates",
                children=[
                    Column(
                        name="lat",
                        dataType="INT",
                        dataTypeDisplay="INT",
                        displayName="lat",
                    ),
                    Column(
                        name="lon",
                        dataType="INT",
                        dataTypeDisplay="INT",
                        displayName="lon",
                    ),
                ],
            ),
        ],
    ),
]


EXAMPLE_JSON_COL_4 = deepcopy(EXAMPLE_JSON_COL_3)

EXAMPLE_JSON_TEST_5 = """
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Person",
  "type": "object",
  "properties": {
    "firstName": {
      "type": "string",
      "title": "First Name",
      "description": "The person's first name."
    },
    "lastName": {
      "title": "Last Name",
      "type": "string",
      "description": "The person's last name."
    },
    "age": {
      "type": "integer",
      "description": "Age in years.",
      "minimum": 0
    }
  },
  "required": ["firstName", "lastName"]
}
"""

EXAMPLE_JSON_COL_5 = [
    Column(
        name="Person",
        dataType="RECORD",
        children=[
            Column(
                name="firstName",
                dataType="STRING",
                description="The person's first name.",
                displayName="First Name",
            ),
            Column(
                name="lastName",
                dataType="STRING",
                description="The person's last name.",
                displayName="Last Name",
            ),
            Column(
                name="age",
                dataType="INT",
                description="Age in years.",
            ),
        ],
    )
]


EXAMPLE_JSON_COL_4[3].children[3].children = [
    Column(
        name="lat",
        dataType="INT",
        dataTypeDisplay="INT",
        displayName="lat",
    ),
    Column(
        name="lon",
        dataType="INT",
        dataTypeDisplay="INT",
        displayName="lon",
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
        and self.displayName == other.displayName
        and self.description == other.description
        and self.dataTypeDisplay == other.dataTypeDisplay
        and self.children == other.children
        and _get_str_value(self.arrayDataType) == _get_str_value(other.arrayDataType)
    )


class DatalakeUnitTest(TestCase):
    """
    Datalake Source Unit Tests
    """

    @patch(
        "metadata.ingestion.source.database.datalake.metadata.DatalakeSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_datalake_config)
        self.datalake_source = DatalakeSource.create(
            mock_datalake_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.datalake_source.context.get().__dict__[
            "database"
        ] = MOCK_DATABASE.name.root
        self.datalake_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root

    def test_s3_schema_filer(self):
        self.datalake_source.client._client.list_buckets = lambda: MOCK_S3_SCHEMA
        assert list(self.datalake_source.get_database_schema_names()) == EXPECTED_SCHEMA

    def test_json_file_parse(self):
        """
        Test json data files
        """
        import pandas as pd  # pylint: disable=import-outside-toplevel

        sample_dict = {"name": "John", "age": 16, "sex": "M"}

        exp_df_list = pd.DataFrame.from_records(
            [
                {"name": "John", "age": 16, "sex": "M"},
                {"name": "Milan", "age": 19, "sex": "M"},
            ]
        )
        exp_df_obj = pd.DataFrame.from_records([sample_dict])

        actual_df_1 = JSONDataFrameReader.read_from_json(
            key="file.json", json_text=EXAMPLE_JSON_TEST_1, decode=True
        )[0][0]
        actual_df_2 = JSONDataFrameReader.read_from_json(
            key="file.json", json_text=EXAMPLE_JSON_TEST_2, decode=True
        )[0][0]

        assert actual_df_1.compare(exp_df_list).empty
        assert actual_df_2.compare(exp_df_obj).empty

        Column.__eq__ = custom_column_compare

        actual_df_3 = JSONDataFrameReader.read_from_json(
            key="file.json", json_text=EXAMPLE_JSON_TEST_3, decode=True
        )[0][0]
        actual_cols_3 = GenericDataFrameColumnParser._get_columns(
            actual_df_3
        )  # pylint: disable=protected-access
        assert actual_cols_3 == EXAMPLE_JSON_COL_3

        actual_df_4 = JSONDataFrameReader.read_from_json(
            key="file.json", json_text=EXAMPLE_JSON_TEST_4, decode=True
        )[0][0]
        actual_cols_4 = GenericDataFrameColumnParser._get_columns(
            actual_df_4
        )  # pylint: disable=protected-access
        assert actual_cols_4 == EXAMPLE_JSON_COL_4

        actual_df_5, raw_data = JSONDataFrameReader.read_from_json(
            key="file.json", json_text=EXAMPLE_JSON_TEST_5, decode=True
        )
        json_parser = JsonDataFrameColumnParser(actual_df_5[0], raw_data=raw_data)
        actual_cols_5 = json_parser.get_columns()
        assert actual_cols_5 == EXAMPLE_JSON_COL_5

    def test_avro_file_parse(self):
        columns = AvroDataFrameReader.read_from_avro(AVRO_SCHEMA_FILE)
        Column.__eq__ = custom_column_compare

        assert EXPECTED_AVRO_COL_1 == columns.columns  # pylint: disable=no-member

        columns = AvroDataFrameReader.read_from_avro(AVRO_DATA_FILE)
        assert EXPECTED_AVRO_COL_2 == columns.columns  # pylint: disable=no-member


mock_datalake_gcs_config = {
    "source": {
        "type": "datalake",
        "serviceName": "local_datalake",
        "serviceConnection": {
            "config": {
                "type": "Datalake",
                "configSource": {
                    "securityConfig": {
                        "gcpConfig": {
                            "type": "service_account",
                            "projectId": "project_id",
                            "privateKeyId": "private_key_id",
                            "privateKey": "private_key",
                            "clientEmail": "gcpuser@project_id.iam.gserviceaccount.com",
                            "clientId": "1234",
                            "authUri": "https://accounts.google.com/o/oauth2/auth",
                            "tokenUri": "https://oauth2.googleapis.com/token",
                            "authProviderX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
                            "clientX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
                        }
                    }
                },
                "bucketName": "my_bucket",
                "prefix": "prefix",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "loggerLevel": "DEBUG",
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "datalake"},
        },
    },
}

mock_multiple_project_id = deepcopy(mock_datalake_gcs_config)

mock_multiple_project_id["source"]["serviceConnection"]["config"]["configSource"][
    "securityConfig"
]["gcpConfig"]["projectId"] = ["project_id", "project_id2"]


class DatalakeGCSUnitTest(TestCase):
    """
    Datalake Source Unit Tests
    """

    @patch(
        "metadata.ingestion.source.database.datalake.metadata.DatalakeSource.test_connection"
    )
    @patch("metadata.utils.credentials.validate_private_key")
    @patch("google.cloud.storage.Client")
    def __init__(self, methodName, _, __, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(
            mock_datalake_gcs_config
        )
        self.datalake_source = DatalakeSource.create(
            mock_datalake_gcs_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.datalake_source.context.get().__dict__[
            "database"
        ] = MOCK_DATABASE.name.root
        self.datalake_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root

    @patch(
        "metadata.ingestion.source.database.datalake.metadata.DatalakeSource.test_connection"
    )
    @patch("google.cloud.storage.Client")
    @patch("metadata.utils.credentials.validate_private_key")
    def test_multiple_project_id_implementation(
        self, validate_private_key, storage_client, test_connection
    ):
        print(mock_multiple_project_id)
        self.datalake_source_multiple_project_id = DatalakeSource.create(
            mock_multiple_project_id["source"],
            OpenMetadataWorkflowConfig.model_validate(
                mock_multiple_project_id
            ).workflowConfig.openMetadataServerConfig,
        )

    def test_gcs_schema_filer(self):
        self.datalake_source.client._client.list_buckets = lambda: MOCK_GCS_SCHEMA
        assert (
            list(self.datalake_source.get_database_schema_names())
            == EXPECTED_GCS_SCHEMA
        )
