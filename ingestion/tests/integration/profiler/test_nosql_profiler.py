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
from random import choice, randint
from unittest import TestCase

from pymongo import MongoClient, database
from testcontainers.mongodb import MongoDbContainer

from ingestion.tests.integration.integration_base import int_admin_ometa
from metadata.generated.schema.entity.data.table import ColumnProfile, Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.api.models import TableConfig
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.test_utils import accumulate_errors
from metadata.utils.time_utils import get_end_of_day_timestamp_mill
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow
from metadata.workflow.workflow_output_handler import print_status

SERVICE_NAME = Path(__file__).stem


def add_query_config(config, table_config: TableConfig) -> dict:
    config_copy = deepcopy(config)
    config_copy["processor"]["config"].setdefault("tableConfig", [])
    config_copy["processor"]["config"]["tableConfig"].append(table_config)
    return config_copy


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
            "loggerLevel": "DEBUG",
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "authProvider": "openmetadata",
                "securityConfig": {
                    "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
                },
            },
        },
    }


TEST_DATABASE = "test-database"
EMPTY_COLLECTION = "empty-collection"
TEST_COLLECTION = "test-collection"
NUM_ROWS = 200


def random_row():
    return {
        "name": choice(["John", "Jane", "Alice", "Bob"]),
        "age": randint(20, 60),
        "city": choice(["New York", "Chicago", "San Francisco"]),
        "nested": {"key": "value" + str(randint(1, 10))},
    }


TEST_DATA = [random_row() for _ in range(NUM_ROWS)] + [
    {
        "name": "John",
        "age": 60,
        "city": "New York",
    },
    {
        "name": "Jane",
        "age": 20,
        "city": "New York",
    },
]


class NoSQLProfiler(TestCase):
    """datalake profiler E2E test"""

    mongo_container: MongoDbContainer
    client: MongoClient
    db: database.Database
    collection: database.Collection
    ingestion_config: dict
    metadata: OpenMetadata

    @classmethod
    def setUpClass(cls) -> None:
        cls.metadata = int_admin_ometa()
        cls.mongo_container = MongoDbContainer("mongo:7.0.5-jammy")
        cls.mongo_container.start()
        cls.client = MongoClient(cls.mongo_container.get_connection_url())
        cls.db = cls.client[TEST_DATABASE]
        cls.collection = cls.db[TEST_COLLECTION]
        cls.collection.insert_many(TEST_DATA)
        cls.db.create_collection(EMPTY_COLLECTION)
        cls.ingestion_config = get_ingestion_config(
            cls.mongo_container.get_exposed_port("27017"), "test", "test"
        )
        # cls.client["admin"].command("grantRolesToUser", "test", roles=["userAdminAnyDatabase"])
        ingestion_workflow = MetadataWorkflow.create(
            cls.ingestion_config,
        )
        ingestion_workflow.execute()
        ingestion_workflow.raise_from_status()
        print_status(ingestion_workflow)
        ingestion_workflow.stop()

    @classmethod
    def tearDownClass(cls):
        with accumulate_errors() as error_handler:
            error_handler.try_execute(partial(cls.mongo_container.stop, force=True))
            error_handler.try_execute(cls.delete_service)

    @classmethod
    def delete_service(cls):
        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn=SERVICE_NAME
            ).id.__root__
        )
        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_setup_teardown(self):
        """
        does nothing. useful to check if the setup and teardown methods are working
        """
        pass

    def run_profiler_workflow(self, config):
        profiler_workflow = ProfilerWorkflow.create(config)
        profiler_workflow.execute()
        status = profiler_workflow.result_status()
        profiler_workflow.stop()
        assert status == 0

    def test_simple(self):
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
        self.run_profiler_workflow(workflow_config)

        cases = [
            {
                "collection": EMPTY_COLLECTION,
                "expected": {
                    "rowCount": 0,
                    "columns": [],
                },
            },
            {
                "collection": TEST_COLLECTION,
                "expected": {
                    "rowCount": len(TEST_DATA),
                    "columns": [
                        ColumnProfile(
                            name="age",
                            timestamp=datetime.now().timestamp(),
                            max=60,
                            min=20,
                        ),
                    ],
                },
            },
        ]

        for tc in cases:
            collection = tc["collection"]
            expected = tc["expected"]
            collection_profile = self.metadata.get_profile_data(
                f"{SERVICE_NAME}.default.{TEST_DATABASE}.{collection}",
                datetime_to_ts(datetime.now() - timedelta(seconds=10)),
                get_end_of_day_timestamp_mill(),
            )
            assert collection_profile.entities
            assert collection_profile.entities[-1].rowCount == expected["rowCount"]
            column_profile = self.metadata.get_profile_data(
                f"{SERVICE_NAME}.default.{TEST_DATABASE}.{collection}.age",
                datetime_to_ts(datetime.now() - timedelta(seconds=10)),
                get_end_of_day_timestamp_mill(),
                profile_type=ColumnProfile,
            )
            assert (len(column_profile.entities) > 0) == (
                len(tc["expected"]["columns"]) > 0
            )
            if len(expected["columns"]) > 0:
                for c1, c2 in zip(column_profile.entities, expected["columns"]):
                    assert c1.name == c2.name
                    assert c1.max == c2.max
                    assert c1.min == c2.min

        table = self.metadata.get_by_name(
            Table, f"{SERVICE_NAME}.default.{TEST_DATABASE}.{TEST_COLLECTION}"
        )
        sample_data = self.metadata.get_sample_data(table)
        assert [c.__root__ for c in sample_data.sampleData.columns] == [
            "_id",
            "name",
            "age",
            "city",
            "nested",
        ]
        assert len(sample_data.sampleData.rows) == SAMPLE_DATA_DEFAULT_COUNT

    def test_custom_query(self):
        workflow_config = deepcopy(self.ingestion_config)
        workflow_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "Profiler",
            }
        )
        query_age = TEST_DATA[0]["age"]
        workflow_config["processor"] = {
            "type": "orm-profiler",
            "config": {
                "tableConfig": [
                    {
                        "fullyQualifiedName": f"{SERVICE_NAME}.default.{TEST_DATABASE}.{TEST_COLLECTION}",
                        "profileQuery": '{"age": %s}' % query_age,
                    }
                ],
            },
        }
        self.run_profiler_workflow(workflow_config)

        cases = [
            {
                "collection": EMPTY_COLLECTION,
                "expected": {
                    "rowCount": 0,
                    "columns": [],
                },
            },
            {
                "collection": TEST_COLLECTION,
                "expected": {
                    "rowCount": len(TEST_DATA),
                    "columns": [
                        ColumnProfile(
                            name="age",
                            timestamp=datetime.now().timestamp(),
                            max=query_age,
                            min=query_age,
                        ),
                    ],
                },
            },
        ]

        for tc in cases:
            collection = tc["collection"]
            expected_row_count = tc["expected"]["rowCount"]

            collection_profile = self.metadata.get_profile_data(
                f"{SERVICE_NAME}.default.{TEST_DATABASE}.{collection}",
                datetime_to_ts(datetime.now() - timedelta(seconds=10)),
                get_end_of_day_timestamp_mill(),
            )
            assert collection_profile.entities, collection
            assert (
                collection_profile.entities[-1].rowCount == expected_row_count
            ), collection
            column_profile = self.metadata.get_profile_data(
                f"{SERVICE_NAME}.default.{TEST_DATABASE}.{collection}.age",
                datetime_to_ts(datetime.now() - timedelta(seconds=10)),
                get_end_of_day_timestamp_mill(),
                profile_type=ColumnProfile,
            )
            assert (len(column_profile.entities) > 0) == (
                len(tc["expected"]["columns"]) > 0
            )
        table = self.metadata.get_by_name(
            Table, f"{SERVICE_NAME}.default.{TEST_DATABASE}.{TEST_COLLECTION}"
        )
        sample_data = self.metadata.get_sample_data(table)
        age_column_index = [
            col.__root__ for col in sample_data.sampleData.columns
        ].index("age")
        assert all(
            [r[age_column_index] == query_age for r in sample_data.sampleData.rows]
        )
