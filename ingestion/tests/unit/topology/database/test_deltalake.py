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
# Test Deltalake using the topology

# Here we don't need to patch, as we can just create our own metastore
# """
# import shutil
# import sys
# import unittest
# from datetime import date, datetime
# from unittest import TestCase

# from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
# from metadata.generated.schema.api.data.createDatabaseSchema import (
#     CreateDatabaseSchemaRequest,
# )
# from metadata.generated.schema.api.data.createTable import CreateTableRequest
# from metadata.generated.schema.entity.data.database import Database
# from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
# from metadata.generated.schema.entity.data.table import Column, DataType, TableType
# from metadata.generated.schema.entity.services.databaseService import (
#     DatabaseConnection,
#     DatabaseService,
#     DatabaseServiceType,
# )
# from metadata.generated.schema.metadataIngestion.workflow import (
#     OpenMetadataWorkflowConfig,
# )
# from metadata.generated.schema.type.basic import FullyQualifiedEntityName
# from metadata.generated.schema.type.entityReference import EntityReference
# from metadata.ingestion.ometa.ometa_api import OpenMetadata
# from metadata.ingestion.source.database.deltalake.metadata import DeltalakeSource

# METASTORE_PATH = "/tmp/spark/unit/metastore"
# SPARK_SQL_WAREHOUSE = "/tmp/spark/unit/warehouse"

# MOCK_DELTA_CONFIG = {
#     "source": {
#         "type": "deltalake",
#         "serviceName": "delta",
#         "serviceConnection": {
#             "config": {
#                 "type": "DeltaLake",
#                 "metastoreConnection": {
#                     "metastoreFilePath": METASTORE_PATH,
#                 },
#                 "connectionArguments": {
#                     "spark.sql.warehouse.dir": SPARK_SQL_WAREHOUSE,
#                 },
#             }
#         },
#         "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
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
#     name="delta",
#     fullyQualifiedName="delta",
#     connection=DatabaseConnection(),
#     serviceType=DatabaseServiceType.DeltaLake,
# )

# MOCK_DATABASE = Database(
#     id="2004514B-A800-4D92-8442-14B2796F712E",
#     name="default",
#     fullyQualifiedName="delta.default",
#     service=EntityReference(
#         id="85811038-099a-11ed-861d-0242ac120002", type="databaseService"
#     ),
# )

# MOCK_DATABASE_SCHEMA = DatabaseSchema(
#     id="92D36A9B-B1A9-4D0A-A00B-1B2ED137ABA5",
#     name="default",
#     fullyQualifiedName="delta.default.default",
#     database=EntityReference(
#         id="2004514B-A800-4D92-8442-14B2796F712E", type="database"
#     ),
#     service=EntityReference(
#         id="85811038-099a-11ed-861d-0242ac120002", type="databaseService"
#     ),
# )


# @unittest.skipUnless(
#     sys.version_info < (3, 11),
#     reason="https://github.com/open-metadata/OpenMetadata/issues/14408",
# )
# class DeltaLakeUnitTest(TestCase):
#     """
#     Add method validations from Deltalake ingestion
#     """

#     config: OpenMetadataWorkflowConfig = OpenMetadataWorkflowConfig.parse_obj(
#         MOCK_DELTA_CONFIG
#     )
#     delta: DeltalakeSource = DeltalakeSource.create(
#         MOCK_DELTA_CONFIG["source"],
#         OpenMetadata(config.workflowConfig.openMetadataServerConfig),
#     )
#     spark = delta.spark

#     @classmethod
#     def setUpClass(cls) -> None:
#         """
#         Prepare the SparkSession and metastore
#         """
#         df = cls.spark.createDataFrame(
#             [
#                 (1, 2.0, "string1", date(2000, 1, 1), datetime(2000, 1, 1, 12, 0)),
#                 (2, 3.0, "string2", date(2000, 2, 1), datetime(2000, 1, 2, 12, 0)),
#                 (3, 4.0, "string3", date(2000, 3, 1), datetime(2000, 1, 3, 12, 0)),
#             ],
#             schema="a long, b double, c string, d date, e timestamp",
#         )

#         # Create the DF as a tmp view to be able to run Spark SQL statements on top
#         df.createOrReplaceTempView("tmp_df")
#         # If no db is specified, the table will be created under `default`
#         cls.spark.sql(
#             "CREATE TABLE IF NOT EXISTS my_df COMMENT 'testing around' AS SELECT * FROM tmp_df"
#         )

#         # Create a database. We will be ingesting that as a schema
#         cls.spark.sql(
#             f"CREATE DATABASE sample_db LOCATION '{SPARK_SQL_WAREHOUSE}/sample_db'"
#         )

#         # Set context
#         cls.delta.context.__dict__[
#             "database_service"
#         ] = MOCK_DATABASE_SERVICE.name.__root__
#         cls.delta.context.__dict__["database"] = MOCK_DATABASE.name.__root__
#         cls.delta.context.__dict__[
#             "database_schema"
#         ] = MOCK_DATABASE_SCHEMA.name.__root__
#         # We pick up the table comments when getting their name and type, so we
#         # store the description in the context
#         cls.delta.context.__dict__["table_description"] = "testing around"

#     @classmethod
#     def tearDownClass(cls) -> None:
#         """
#         Clean up
#         """
#         shutil.rmtree(METASTORE_PATH)
#         shutil.rmtree(SPARK_SQL_WAREHOUSE)

#     def test_get_database_names(self):
#         database_names = list(self.delta.get_database_names())
#         self.assertEqual(database_names, ["default"])

#     def test_yield_database(self):
#         database_request = next(
#             self.delta.yield_database(database_name="default")
#         ).right
#         expected_database_request = CreateDatabaseRequest(
#             name="default",
#             service=FullyQualifiedEntityName(__root__="delta"),
#         )

#         self.assertEqual(database_request, expected_database_request)

#     def test_get_database_schema_names(self):
#         schema_names = set(self.delta.get_database_schema_names())
#         self.assertEqual(schema_names, {"default", "sample_db"})

#     def test_yield_database_schema(self):
#         schema_request = next(
#             self.delta.yield_database_schema(schema_name="default")
#         ).right
#         expected_schema_request = CreateDatabaseSchemaRequest(
#             name="default", database="delta.default"
#         )

#         self.assertEqual(schema_request, expected_schema_request)

#     def test_get_tables_name_and_type(self):
#         table_names = list(self.delta.get_tables_name_and_type())
#         # We won't ingest TMP tables
#         self.assertEqual(table_names, [("my_df", TableType.Regular)])

#     def test_yield_table(self):
#         table_request = next(
#             self.delta.yield_table(table_name_and_type=("my_df", TableType.Regular))
#         ).right

#         expected_columns = [
#             Column(name="a", dataType=DataType.BIGINT, dataTypeDisplay="bigint"),
#             Column(name="b", dataType=DataType.DOUBLE, dataTypeDisplay="double"),
#             Column(name="c", dataType=DataType.STRING, dataTypeDisplay="string"),
#             Column(name="d", dataType=DataType.DATE, dataTypeDisplay="date"),
#             Column(name="e", dataType=DataType.TIMESTAMP, dataTypeDisplay="timestamp"),
#         ]

#         expected_table_request = CreateTableRequest(
#             name="my_df",
#             tableType=TableType.Regular,
#             description="testing around",
#             columns=expected_columns,
#             tableConstraints=None,
#             databaseSchema=MOCK_DATABASE_SCHEMA.fullyQualifiedName,
#             viewDefinition=None,
#         )

#         self.assertEqual(table_request, expected_table_request)
