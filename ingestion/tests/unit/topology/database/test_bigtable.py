# #  Copyright 2021 Collate
# #  Licensed under the Apache License, Version 2.0 (the "License");
# #  you may not use this file except in compliance with the License.
# #  You may obtain a copy of the License at
# #  http://www.apache.org/licenses/LICENSE-2.0
# #  Unless required by applicable law or agreed to in writing, software
# #  distributed under the License is distributed on an "AS IS" BASIS,
# #  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# #  See the License for the specific language governing permissions and
# #  limitations under the License.

# """
# Test MongoDB using the topology
# """

# import json
# from pathlib import Path
# from unittest import TestCase
# from unittest.mock import Mock, patch

# import pytest

# from metadata.generated.schema.api.data.createTable import CreateTableRequest
# from metadata.generated.schema.entity.data.database import Database
# from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
# from metadata.generated.schema.entity.data.table import (
#     Column,
#     ConstraintType,
#     DataType,
#     TableConstraint,
#     TableType,
# )
# from metadata.generated.schema.entity.services.databaseService import (
#     DatabaseConnection,
#     DatabaseService,
#     DatabaseServiceType,
# )
# from metadata.generated.schema.metadataIngestion.workflow import (
#     OpenMetadataWorkflowConfig,
# )
# from metadata.generated.schema.type.basic import SourceUrl
# from metadata.generated.schema.type.entityReference import EntityReference
# from metadata.ingestion.ometa.ometa_api import OpenMetadata
# from metadata.ingestion.source.database.bigtable.metadata import BigtableSource

# mock_file_path = (
#     Path(__file__).parent.parent.parent / "resources/datasets/glue_db_dataset.json"
# )
# with open(mock_file_path) as file:
#     mock_data: dict = json.load(file)

# mock_bigtable_config = {
#     "source": {
#         "type": "bigtable",
#         "serviceName": "local_bigtable",
#         "serviceConnection": {
#             "config": {
#                 "type": "BigTable",
#                 "credentials": {
#                     "gcpConfig": {
#                         "type": "service_account",
#                         "projectId": "my-gcp-project",
#                         "privateKeyId": "private_key_id",
#                         # this is a valid key that was generated on a local machine and is not used for any real project
#                         "privateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpQIBAAKCAQEAw3vHG9fDIkcYB0xi2Mv4fS2gUzKR9ZRrcVNeKkqGFTT71AVB\nOzgIqYVe8b2aWODuNye6sipcrqTqOt05Esj+sxhk5McM9bE2RlxXC5QH/Bp9zxMP\n/Yksv9Ov7fdDt/loUk7sTXvI+7LDJfmRYU6MtVjyyLs7KpQIB2xBWEToU1xZY+v0\ndRC1NA+YWc+FjXbAiFAf9d4gXkYO8VmU5meixVh4C8nsjokEXk0T/HEItpZCxadk\ndZ7LKUE/HDmWCO2oNG6sCf4ET2crjSdYIfXuREopX1aQwnk7KbI4/YIdlRz1I369\nAz3+Hxlf9lLJVH3+itN4GXrR9yWWKWKDnwDPbQIDAQABAoIBAQC3X5QuTR7SN8iV\niBUtc2D84+ECSmza5shG/UJW/6N5n0Mf53ICgBS4GNEwiYCRISa0/ILIgK6CcVb7\nsuvH8F3kWNzEMui4TO0x4YsR5GH9HkioCCS224frxkLBQnL20HIIy9ok8Rpe6Zjg\nNZUnp4yczPyqSeA9l7FUbTt69uDM2Cx61m8REOpFukpnYLyZGbmNPYmikEO+rq9r\nwNID5dkSeVuQYo4MQdRavOGFUWvUYXzkEQ0A6vPyraVBfolESX8WaLNVjic7nIa3\nujdSNojnJqGJ3gslntcmN1d4JOfydc4bja4/NdNlcOHpWDGLzY1QnaDe0Koxn8sx\nLT9MVD2NAoGBAPy7r726bKVGWcwqTzUuq1OWh5c9CAc4N2zWBBldSJyUdllUq52L\nWTyva6GRoRzCcYa/dKLLSM/k4eLf9tpxeIIfTOMsvzGtbAdm257ndMXNvfYpxCfU\nK/gUFfAUGHZ3MucTHRY6DTkJg763Sf6PubA2fqv3HhVZDK/1HGDtHlTPAoGBAMYC\npdV7O7lAyXS/d9X4PQZ4BM+P8MbXEdGBbPPlzJ2YIb53TEmYfSj3z41u9+BNnhGP\n4uzUyAR/E4sxrA2+Ll1lPSCn+KY14WWiVGfWmC5j1ftdpkbrXstLN8NpNYzrKZwx\njdR0ZkwvZ8B5+kJ1hK96giwWS+SJxJR3TohcQ18DAoGAJSfmv2r//BBqtURnHrd8\nwq43wvlbC8ytAVg5hA0d1r9Q4vM6w8+vz+cuWLOTTyobDKdrG1/tlXrd5r/sh9L0\n15SIdkGm3kPTxQbPNP5sQYRs8BrV1tEvoao6S3B45DnEBwrdVN42AXOvpcNGoqE4\nuHpahyeuiY7s+ZV8lZdmxSsCgYEAolr5bpmk1rjwdfGoaKEqKGuwRiBX5DHkQkxE\n8Zayt2VOBcX7nzyRI05NuEIMrLX3rZ61CktN1aH8fF02He6aRaoE/Qm9L0tujM8V\nNi8WiLMDeR/Ifs3u4/HAv1E8v1byv0dCa7klR8J257McJ/ID4X4pzcxaXgE4ViOd\nGOHNu9ECgYEApq1zkZthEQymTUxs+lSFcubQpaXyf5ZC61cJewpWkqGDtSC+8DxE\nF/jydybWuoNHXymnvY6QywxuIooivbuib6AlgpEJeybmnWlDOZklFOD0abNZ+aNO\ndUk7XVGffCakXQ0jp1kmZA4lGsYK1h5dEU5DgXqu4UYJ88Vttax2W+Y=\n-----END RSA PRIVATE KEY-----\n",
#                         "clientEmail": "gcpuser@project_id.iam.gserviceaccount.com",
#                         "clientId": "client_id",
#                         "authUri": "https://accounts.google.com/o/oauth2/auth",
#                         "tokenUri": "https://oauth2.googleapis.com/token",
#                         "authProviderX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
#                         "clientX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
#                     }
#                 },
#             },
#         },
#         "sourceConfig": {
#             "config": {
#                 "type": "DatabaseMetadata",
#                 "schemaFilterPattern": {"includes": ["my_instance"]},
#                 "tableFilterPattern": {"includes": ["random_table"]},
#             }
#         },
#     },
#     "sink": {"type": "metadata-rest", "config": {}},
#     "workflowConfig": {
#         "openMetadataServerConfig": {
#             "hostPort": "http://localhost:8585/api",
#             "authProvider": "openmetadata",
#             "securityConfig": {
#                 "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
#             },
#         }
#     },
# }

# MOCK_DATABASE_SERVICE = DatabaseService(
#     id="85811038-099a-11ed-861d-0242ac120002",
#     name="local_bigtable",
#     connection=DatabaseConnection(),
#     serviceType=DatabaseServiceType.Glue,
# )

# MOCK_DATABASE = Database(
#     id="2aaa012e-099a-11ed-861d-0242ac120002",
#     name="my-gcp-project",
#     fullyQualifiedName="local_bigtable.my-gcp-project",
#     displayName="my-gcp-project",
#     description="",
#     service=EntityReference(
#         id="85811038-099a-11ed-861d-0242ac120002",
#         type="databaseService",
#     ),
# )

# MOCK_DATABASE_SCHEMA = DatabaseSchema(
#     id="2aaa012e-099a-11ed-861d-0242ac120056",
#     name="my_instance",
#     fullyQualifiedName="local_bigtable.my-gcp-project.my_instance",
#     displayName="default",
#     description="",
#     database=EntityReference(
#         id="2aaa012e-099a-11ed-861d-0242ac120002",
#         type="database",
#     ),
#     service=EntityReference(
#         id="85811038-099a-11ed-861d-0242ac120002",
#         type="databaseService",
#     ),
# )


# MOCK_CREATE_TABLE = CreateTableRequest(
#     name="random_table",
#     tableType=TableType.Regular,
#     columns=[
#         Column(
#             name="row_key",
#             displayName="row_key",
#             dataType=DataType.BYTES,
#             dataTypeDisplay=DataType.BYTES.value,
#         ),
#         Column(
#             name="cf1.col1",
#             displayName="cf1.col1",
#             dataType=DataType.BYTES,
#             dataTypeDisplay=DataType.BYTES.value,
#         ),
#         Column(
#             name="cf2.col2",
#             displayName="cf2.col2",
#             dataType=DataType.BYTES,
#             dataTypeDisplay=DataType.BYTES.value,
#         ),
#     ],
#     tableConstraints=[
#         TableConstraint(constraintType=ConstraintType.PRIMARY_KEY, columns=["row_key"])
#     ],
#     databaseSchema="local_bigtable.my-gcp-project.my_instance",
#     sourceUrl=SourceUrl(
#         __root__="https://console.cloud.google.com/bigtable/instances/my_instance/tables/random_table/overview?project=my-gcp-project"
#     ),
# )


# EXPECTED_DATABASE_NAMES = ["my-gcp-project"]

# EXPECTED_DATABASE_SCHEMA_NAMES = [
#     "my_instance",
# ]

# MOCK_DATABASE_SCHEMA_NAMES = [
#     "my_instance",
#     "random1_schema",
# ]

# EXPECTED_TABLE_NAMES = [
#     ("random_table", TableType.Regular),
# ]


# def custom_column_compare(self, other):
#     return (
#         self.name == other.name
#         and self.description == other.description
#         and self.children == other.children
#     )


# @pytest.fixture
# def mock_bigtable_row():
#     mock = Mock()
#     cell = Mock()
#     cell.value = b"cell_value"
#     cell.timestamp = 1234567890
#     mock.cells = {"cf1": {b"col1": [cell]}, "cf2": {b"col2": [cell]}}
#     mock.row_key = b"row_key"
#     yield mock


# @pytest.fixture
# def mock_bigtable_table(mock_bigtable_row):
#     mock = Mock()
#     mock.table_id = "random_table"
#     mock.list_column_families.return_value = {"cf1": None, "cf2": None}
#     mock.read_rows.return_value = [mock_bigtable_row]
#     yield mock


# @pytest.fixture
# def mock_bigtable_instance(mock_bigtable_table):
#     mock = Mock()
#     mock.instance_id = "my_instance"
#     mock.project_id = "my-gcp-project"
#     mock.list_tables.return_value = [mock_bigtable_table]
#     yield mock


# @pytest.fixture
# def mock_google_cloud_client(mock_bigtable_instance):
#     with patch("google.cloud.bigtable.Client") as mock_client:
#         mock_client.list_instances.return_value = [[], []]
#         mock_client().list_instances.return_value = [[mock_bigtable_instance], []]
#         yield mock_client


# @pytest.fixture
# def mock_test_connection():
#     with patch.object(BigtableSource, "test_connection") as mock_test_connection:
#         mock_test_connection.return_value = True
#         yield mock_test_connection


# class BigTableUnitTest(TestCase):
#     @pytest.fixture(autouse=True)
#     def setup(
#         self,
#         monkeypatch,
#         mock_google_cloud_client,
#         mock_test_connection,
#         mock_bigtable_instance,
#         mock_bigtable_table,
#     ):
#         self.config = OpenMetadataWorkflowConfig.parse_obj(mock_bigtable_config)
#         self.bigtable_source = BigtableSource.create(
#             mock_bigtable_config["source"],
#             OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
#         )
#         self.bigtable_source.context.__dict__[
#             "database_service"
#         ] = MOCK_DATABASE_SERVICE.name.__root__
#         self.bigtable_source.context.__dict__["database"] = MOCK_DATABASE.name.__root__
#         self.bigtable_source.context.__dict__[
#             "database_schema"
#         ] = MOCK_DATABASE_SCHEMA.name.__root__
#         self.bigtable_source.instances = {
#             "my-gcp-project": {
#                 mock_bigtable_instance.instance_id: mock_bigtable_instance
#             }
#         }
#         self.bigtable_source.tables = {
#             "my-gcp-project": {
#                 mock_bigtable_instance.instance_id: {
#                     mock_bigtable_table.table_id: mock_bigtable_table
#                 }
#             }
#         }

#     def test_database_names(self):
#         assert (
#             list(self.bigtable_source.get_database_names()) == EXPECTED_DATABASE_NAMES
#         )

#     def test_database_schema_names(self):
#         assert (
#             list(self.bigtable_source.get_database_schema_names())
#             == EXPECTED_DATABASE_SCHEMA_NAMES
#         )

#     def test_table_names(self):
#         assert (
#             list(self.bigtable_source.get_tables_name_and_type())
#             == EXPECTED_TABLE_NAMES
#         )

#     def test_yield_tables(self):
#         Column.__eq__ = custom_column_compare
#         result = next(self.bigtable_source.yield_table(EXPECTED_TABLE_NAMES[0]))
#         assert result.left is None
#         assert result.right.name.__root__ == "random_table"
#         assert result.right == MOCK_CREATE_TABLE
