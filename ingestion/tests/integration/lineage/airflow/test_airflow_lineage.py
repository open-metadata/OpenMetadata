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
Test airflow lineage backend
"""

from datetime import datetime, timedelta
from unittest import TestCase

# The DAG object; we'll need this to instantiate a DAG
from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.serialization.serialized_objects import (
    SerializedBaseOperator,
    SerializedDAG,
)

from airflow_provider_openmetadata.lineage.openmetadata import (
    ALLOWED_FLOW_KEYS,
    ALLOWED_TASK_KEYS,
    OpenMetadataLineageBackend,
    get_properties,
    get_xlets,
)
from airflow_provider_openmetadata.lineage.utils import (
    iso_dag_start_date,
    iso_task_start_end_date,
)
from metadata.generated.schema.api.data.createDatabase import (
    CreateDatabaseEntityRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableEntityRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceEntityRequest,
)
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig


class AirflowLineageTest(TestCase):
    """
    Run this test installing the necessary airflow version
    """

    server_config = MetadataServerConfig(api_endpoint="http://localhost:8585/api")
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    service = CreateDatabaseServiceEntityRequest(
        name="test-service-table-lineage",
        serviceType=DatabaseServiceType.MySQL,
        databaseConnection=DatabaseConnection(hostPort="localhost"),
    )
    service_type = "databaseService"

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients: Table Entity + DAG
        """

        cls.service_entity = cls.metadata.create_or_update(data=cls.service)

        cls.create_db = CreateDatabaseEntityRequest(
            name="test-db",
            service=EntityReference(id=cls.service_entity.id, type="databaseService"),
        )

        cls.create_db_entity = cls.metadata.create_or_update(data=cls.create_db)

        cls.create = CreateTableEntityRequest(
            name="lineage-test",
            database=cls.create_db_entity.id,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.table = cls.metadata.create_or_update(data=cls.create)

        with DAG(
            "lineage",
            description="A lineage test DAG",
            schedule_interval=timedelta(days=1),
            start_date=datetime(2021, 1, 1),
        ) as dag:

            t1 = BashOperator(  # Using BashOperator as a random example
                task_id="task1",
                bash_command="date",
                outlets={"tables": ["test-service-table-lineage.test-db.lineage-test"]},
            )

            t2 = BashOperator(  # Using BashOperator as a random example
                task_id="task2",
                bash_command="sleep 5",
                inlets={"tables": ["test-service-table-lineage.test-db.lineage-test"]},
            )

            t3 = BashOperator(
                task_id="task3",
                bash_command="echo",
            )

            t1 >> t2 >> t3

            cls.dag = dag

    def test_xlets(self):
        """
        Verify that we can extract inlets and outlets
        """

        self.assertIsNone(get_xlets(self.dag.get_task("task1"), "_inlets"))
        self.assertEqual(
            ["test-service-table-lineage.test-db.lineage-test"],
            get_xlets(self.dag.get_task("task1"), "_outlets"),
        )

        self.assertEqual(
            ["test-service-table-lineage.test-db.lineage-test"],
            get_xlets(self.dag.get_task("task2"), "_inlets"),
        )
        self.assertIsNone(get_xlets(self.dag.get_task("task2"), "_outlets"))

        self.assertIsNone(get_xlets(self.dag.get_task("task3"), "_inlets"))
        self.assertIsNone(get_xlets(self.dag.get_task("task3"), "_outlets"))

    def test_properties(self):
        """
        check props
        """

        dag_props = get_properties(
            self.dag, SerializedDAG.serialize_dag, ALLOWED_FLOW_KEYS
        )
        self.assertTrue(set(dag_props.keys()).issubset(ALLOWED_FLOW_KEYS))

        task1_props = get_properties(
            self.dag.get_task("task1"),
            SerializedBaseOperator.serialize_operator,
            ALLOWED_TASK_KEYS,
        )
        self.assertTrue(set(task1_props.keys()).issubset(ALLOWED_TASK_KEYS))

        task2_props = get_properties(
            self.dag.get_task("task2"),
            SerializedBaseOperator.serialize_operator,
            ALLOWED_TASK_KEYS,
        )
        self.assertTrue(set(task2_props.keys()).issubset(ALLOWED_TASK_KEYS))

        task3_props = get_properties(
            self.dag.get_task("task3"),
            SerializedBaseOperator.serialize_operator,
            ALLOWED_TASK_KEYS,
        )
        self.assertTrue(set(task3_props.keys()).issubset(ALLOWED_TASK_KEYS))

    def test_times(self):
        """
        Check the ISO date extraction for DAG and Tasks instances
        """
        dag_props = get_properties(
            self.dag, SerializedDAG.serialize_dag, ALLOWED_FLOW_KEYS
        )

        dag_date = iso_dag_start_date(dag_props)
        self.assertEqual("2021-01-01T00:00:00Z", dag_date)

        # Remove the start_time
        dag_props.pop("start_date")
        dag_none_date = iso_dag_start_date(dag_props)
        self.assertIsNone(dag_none_date)

        # By default we'll get the start_date for the task,
        # so we can check its value, but the end date
        # might not come as in this case.
        # Check that we can have those values as None
        task1_props = get_properties(
            self.dag.get_task("task1"),
            SerializedBaseOperator.serialize_operator,
            ALLOWED_TASK_KEYS,
        )

        task_start_date, task_end_date = iso_task_start_end_date(task1_props)
        self.assertEqual("2021-01-01T00:00:00Z", task_start_date)
        self.assertIsNone(task_end_date)

    def test_lineage(self):
        """
        Test end to end
        """

        backend = OpenMetadataLineageBackend()
        backend.send_lineage(
            operator=self.dag.get_task("task1"),
            context={
                "dag": self.dag,
                "task": self.dag.get_task("task1"),
            },
        )

        self.assertIsNotNone(
            self.metadata.get_by_name(entity=Pipeline, fqdn="airflow.lineage")
        )

        lineage = self.metadata.get_lineage_by_name(
            entity=Pipeline, fqdn="airflow.lineage"
        )

        nodes = {node["id"] for node in lineage["nodes"]}
        self.assertIn(str(self.table.id.__root__), nodes)
