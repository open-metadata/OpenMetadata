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
Validate workflow e2e
"""

import os
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

import sqlalchemy as sqa
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.interfaces.profiler_protocol import ProfilerInterfaceArgs
from metadata.interfaces.sqalchemy.sqa_profiler_interface import SQAProfilerInterface
from metadata.test_suite.api.workflow import TestSuiteWorkflow

test_suite_config = {
    "source": {
        "type": "TestSuite",
        "serviceName": "TestSuiteWorkflow",
        "sourceConfig": {"config": {"type": "TestSuite"}},
    },
    "processor": {
        "type": "orm-test-runner",
        "config": {
            "testSuites": [
                {
                    "name": "my_test_suite",
                    "testCases": [
                        {
                            "name": "my_test_case",
                            "testDefinitionName": "TableColumnCountToBeBetween",
                            "entityLink": "<#E::table::test_suite_service_test.test_suite_database.test_suite_database_schema.users>",
                            "parameterValues": [
                                {"name": "minColValue", "value": 1},
                                {"name": "maxColValue", "value": 5},
                            ],
                        },
                        {
                            "name": "table_column_name_to_exists",
                            "testDefinitionName": "TableColumnNameToExist",
                            "entityLink": "<#E::table::test_suite_service_test.test_suite_database.test_suite_database_schema.users>",
                            "parameterValues": [{"name": "columnName", "value": "id"}],
                        },
                    ],
                }
            ],
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

Base = declarative_base()


class User(Base):
    __tablename__ = ("users",)
    id = sqa.Column(sqa.Integer, primary_key=True)
    name = sqa.Column(sqa.String(256))
    fullname = sqa.Column(sqa.String(256))
    nickname = sqa.Column(sqa.String(256))
    age = sqa.Column(sqa.Integer)


class TestE2EWorkflow(unittest.TestCase):
    """e2e test for the workflow"""

    metadata = OpenMetadata(
        OpenMetadataConnection.parse_obj(
            test_suite_config["workflowConfig"]["openMetadataServerConfig"]
        )
    )

    db_path = os.path.join(
        os.path.dirname(__file__), f"{os.path.splitext(__file__)[0]}.db"
    )
    sqlite_conn = DatabaseConnection(
        config=SQLiteConnection(
            scheme=SQLiteScheme.sqlite_pysqlite,
            databaseMode=db_path + "?check_same_thread=False",
        )
    )

    @classmethod
    def setUpClass(cls):
        """set up class"""
        service: DatabaseService = cls.metadata.create_or_update(
            CreateDatabaseServiceRequest(
                name="test_suite_service_test",
                serviceType=DatabaseServiceType.SQLite,
                connection=cls.sqlite_conn,
            )
        )

        database: Database = cls.metadata.create_or_update(
            CreateDatabaseRequest(
                name="test_suite_database",
                service=service.fullyQualifiedName,
            )
        )

        database_schema: DatabaseSchema = cls.metadata.create_or_update(
            CreateDatabaseSchemaRequest(
                name="test_suite_database_schema",
                database=database.fullyQualifiedName,
            )
        )

        table = cls.metadata.create_or_update(
            CreateTableRequest(
                name="users",
                columns=[
                    Column(name="id", dataType=DataType.INT),
                    Column(name="name", dataType=DataType.STRING),
                    Column(name="fullname", dataType=DataType.STRING),
                    Column(name="nickname", dataType=DataType.STRING),
                    Column(name="age", dataType=DataType.INT),
                ],
                databaseSchema=database_schema.fullyQualifiedName,
            )
        )
        with patch.object(
            SQAProfilerInterface, "_convert_table_to_orm_object", return_value=User
        ):
            sqa_profiler_interface = SQAProfilerInterface(
                profiler_interface_args=ProfilerInterfaceArgs(
                    service_connection_config=cls.sqlite_conn.config,
                    table_entity=table,
                    ometa_client=None,
                )
            )
        engine = sqa_profiler_interface.session.get_bind()
        session = sqa_profiler_interface.session

        User.__table__.create(bind=engine)

        for _ in range(10):
            data = [
                User(
                    name="John",
                    fullname="John Doe",
                    nickname="johnny b goode",
                    age=30,
                ),
                User(
                    name="Jane",
                    fullname="Jone Doe",
                    nickname="Johnny d",
                    age=31,
                ),
                User(
                    name="John",
                    fullname="John Doe",
                    nickname=None,
                    age=None,
                ),
            ]
            session.add_all(data)
            session.commit()

        del sqa_profiler_interface

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """
        service_db_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn="test_suite_service_test"
            ).id.__root__
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_db_id,
            recursive=True,
            hard_delete=True,
        )

        os.remove(cls.db_path)
        return super().tearDownClass()

    def test_e2e_cli_workflow(self):
        """test cli workflow e2e"""
        workflow = TestSuiteWorkflow.create(test_suite_config)
        workflow.execute()

        test_case_1 = self.metadata.get_by_name(
            entity=TestCase,
            fqn="test_suite_service_test.test_suite_database.test_suite_database_schema.users.my_test_case",
            fields=["testDefinition", "testSuite"],
        )
        test_case_2 = self.metadata.get_by_name(
            entity=TestCase,
            fqn="test_suite_service_test.test_suite_database.test_suite_database_schema.users.table_column_name_to_exists",
            fields=["testDefinition", "testSuite"],
        )

        assert test_case_1
        assert test_case_2

        test_case_result_1 = self.metadata.client.get(
            "/testCase/test_suite_service_test.test_suite_database.test_suite_database_schema.users.my_test_case/testCaseResult",
            data={
                "startTs": int((datetime.now() - timedelta(days=3)).timestamp()),
                "endTs": int((datetime.now() + timedelta(days=3)).timestamp()),
            },
        )
        test_case_result_2 = self.metadata.client.get(
            "/testCase/test_suite_service_test.test_suite_database.test_suite_database_schema.users.table_column_name_to_exists/testCaseResult",
            data={
                "startTs": int((datetime.now() - timedelta(days=3)).timestamp()),
                "endTs": int((datetime.now() + timedelta(days=3)).timestamp()),
            },
        )

        assert test_case_result_1
        assert test_case_result_2
