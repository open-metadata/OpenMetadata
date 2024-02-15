#  Copyright 2024 Collate
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
Test the NoSQL profiler using a MongoDB container
To run this we need OpenMetadata server up and running.
No sample data is required beforehand

Test Steps:

1. Start a MongoDB container
2. Ingest data into OpenMetadata
3. Run the profiler workflow
4. Verify the profiler output
5. Tear down the MongoDB container and delete the service from OpenMetadata
"""

from copy import deepcopy
from datetime import datetime, timedelta
from functools import partial
from pathlib import Path
from unittest import TestCase

from pymongo import MongoClient
from testcontainers.mongodb import MongoDbContainer

from ingestion.tests.integration.integration_base import int_admin_ometa
from metadata.generated.schema.entity.data.table import ColumnProfile
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.test_utils import accumulate_errors
from metadata.utils.time_utils import get_end_of_day_timestamp_mill
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow
from metadata.workflow.workflow_output_handler import print_status

SERVICE_NAME = Path(__file__).stem


def get_ingestion_config(mongo_port: str, mongo_user: str, mongo_pass: str):
    return {
        "source": {
            "type": "mongodb",
            "serviceName": SERVICE_NAME,
            "serviceConnection": {
                "config": {
                    "type": "MongoDB",
                    "hostPort": f"localhost:{mongo_port}",
                    "username": mongo_user,
                    "password": mongo_pass,
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
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


TEST_DATABASE = "test-database"
TEST_COLLECTION = "test-collection"
TEST_DATA = [
    {
        "first_name": "John",
        "last_name": "Doe",
        "age": 30,
    },
    {
        "first_name": "Jane",
        "last_name": "Doe",
        "age": 25,
    },
    {
        "first_name": "John",
        "last_name": "Smith",
        "age": 35,
    },
]


class NoSQLProfiler(TestCase):
    """datalake profiler E2E test"""

    @classmethod
    def setUpClass(cls) -> None:
        cls.metadata = int_admin_ometa()

    def setUp(self) -> None:
        self.mongo_container = MongoDbContainer("mongo:7.0.5-jammy")
        self.mongo_container.start()
        self.client = MongoClient(self.mongo_container.get_connection_url())
        self.db = self.client[TEST_DATABASE]
        self.collection = self.db[TEST_COLLECTION]
        self.collection.insert_many(TEST_DATA)
        self.ingestion_config = get_ingestion_config(
            self.mongo_container.get_exposed_port("27017"), "test", "test"
        )
        ingestion_workflow = MetadataWorkflow.create(
            self.ingestion_config,
        )
        ingestion_workflow.execute()
        ingestion_workflow.raise_from_status()
        print_status(ingestion_workflow)
        ingestion_workflow.stop()

    def tearDown(self):
        with accumulate_errors() as error_handler:
            error_handler.try_execute(partial(self.mongo_container.stop, force=True))
            error_handler.try_execute(self.delete_service)

    def delete_service(self):
        service_id = str(
            self.metadata.get_by_name(
                entity=DatabaseService, fqn=SERVICE_NAME
            ).id.__root__
        )
        self.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_setup_teardown(self):
        pass

    def test_row_count(self):
        workflow_config = deepcopy(self.ingestion_config)
        workflow_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "Profiler",
            }
        )
        workflow_config["processor"] = {
            "type": "orm-profiler",
            "config": {},
        }
        profiler_workflow = ProfilerWorkflow.create(workflow_config)
        profiler_workflow.execute()
        status = profiler_workflow.result_status()
        profiler_workflow.stop()

        assert status == 0

        table_profile = self.metadata.get_profile_data(
            f"{SERVICE_NAME}.default.{TEST_DATABASE}.{TEST_COLLECTION}",
            datetime_to_ts(datetime.now() - timedelta(seconds=10)),
            get_end_of_day_timestamp_mill(),
        )

        column_profile = self.metadata.get_profile_data(
            f"{SERVICE_NAME}.default.{TEST_DATABASE}.{TEST_COLLECTION}.age",
            datetime_to_ts(datetime.now() - timedelta(seconds=10)),
            get_end_of_day_timestamp_mill(),
            profile_type=ColumnProfile,
        )
        assert table_profile.entities
        assert table_profile.entities[-1].rowCount == 3
        assert len(column_profile.entities) == 0
