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
Test lineage parser to get inlets and outlets information
"""
from datetime import datetime
from typing import List
from unittest import TestCase
from unittest.mock import patch

from airflow import DAG
from airflow.operators.bash import BashOperator

from _openmetadata_testutils.ometa import int_admin_ometa
from airflow_provider_openmetadata.lineage.runner import AirflowLineageRunner
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.ingestion.source.pipeline.airflow.lineage_parser import (
    OMEntity,
    get_xlets_from_dag,
)

SLEEP = "sleep 1"
PIPELINE_SERVICE_NAME = "test-lineage-runner"
DB_SERVICE_NAME = "test-service-lineage-runner"


def get_captured_log_messages(log) -> List[str]:
    return [record.getMessage() for record in log.records]


class TestAirflowLineageRuner(TestCase):
    """
    Validate AirflowLineageRunner
    """

    metadata = int_admin_ometa()

    service = CreateDatabaseServiceRequest(
        name=DB_SERVICE_NAME,
        serviceType=DatabaseServiceType.Mysql,
        connection=DatabaseConnection(
            config=MysqlConnection(
                username="username",
                authType=BasicAuth(password="password"),
                hostPort="http://localhost:1234",
            )
        ),
    )
    service_type = "databaseService"

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients: Table Entity + DAG
        """

        service_entity = cls.metadata.create_or_update(data=cls.service)

        create_db = CreateDatabaseRequest(
            name="test-db",
            service=service_entity.fullyQualifiedName,
        )

        create_db_entity = cls.metadata.create_or_update(data=create_db)

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema",
            database=create_db_entity.fullyQualifiedName,
        )

        create_schema_entity = cls.metadata.create_or_update(data=create_schema)

        create_inlet = CreateTableRequest(
            name="lineage-test-inlet",
            databaseSchema=create_schema_entity.fullyQualifiedName,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        create_inlet_2 = CreateTableRequest(
            name="lineage-test-inlet2",
            databaseSchema=create_schema_entity.fullyQualifiedName,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        create_outlet = CreateTableRequest(
            name="lineage-test-outlet",
            databaseSchema=create_schema_entity.fullyQualifiedName,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.table_inlet1: Table = cls.metadata.create_or_update(data=create_inlet)
        cls.table_inlet2: Table = cls.metadata.create_or_update(data=create_inlet_2)
        cls.table_outlet: Table = cls.metadata.create_or_update(data=create_outlet)

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn=DB_SERVICE_NAME
            ).id.root
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

        # Service ID created from the Airflow Lineage Operator in the
        # example DAG
        pipeline_service_id = str(
            cls.metadata.get_by_name(
                entity=PipelineService, fqn=PIPELINE_SERVICE_NAME
            ).id.root
        )

        cls.metadata.delete(
            entity=PipelineService,
            entity_id=pipeline_service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_lineage_runner(self):
        with DAG("test_runner", start_date=datetime(2021, 1, 1)) as dag:
            BashOperator(
                task_id="print_date",
                bash_command="date",
                inlets=[
                    OMEntity(
                        entity=Table,
                        fqn="test-service-lineage-runner.test-db.test-schema.lineage-test-inlet",
                    ),
                    OMEntity(
                        entity=Table,
                        fqn="test-service-lineage-runner.test-db.test-schema.lineage-test-inlet2",
                    ),
                ],
            )

            BashOperator(
                task_id="sleep",
                bash_command=SLEEP,
                outlets=[
                    OMEntity(
                        entity=Table,
                        fqn="test-service-lineage-runner.test-db.test-schema.lineage-test-outlet",
                    )
                ],
            )

        # skip the statuses since they require getting data from airflow's db
        with patch.object(
            AirflowLineageRunner, "add_all_pipeline_status", return_value=None
        ):
            runner = AirflowLineageRunner(
                metadata=self.metadata,
                service_name=PIPELINE_SERVICE_NAME,
                dag=dag,
                xlets=get_xlets_from_dag(dag),
                only_keep_dag_lineage=True,
            )

            with self.assertLogs(level="INFO") as log:
                runner.execute()
                messages = get_captured_log_messages(log)
                self.assertIn("Creating Pipeline Entity from DAG...", messages)

            lineage_data = self.metadata.get_lineage_by_name(
                entity=Table,
                fqn=self.table_outlet.fullyQualifiedName.root,
                up_depth=1,
                down_depth=1,
            )

            upstream_ids = [
                edge["fromEntity"] for edge in lineage_data["upstreamEdges"]
            ]
            self.assertIn(str(self.table_inlet1.id.root), upstream_ids)
            self.assertIn(str(self.table_inlet2.id.root), upstream_ids)

            # We can trigger again without any issues. Nothing will happen here
            with self.assertLogs(level="INFO") as log:
                runner.execute()
                messages = get_captured_log_messages(log)
                self.assertIn("DAG has not changed since last run", messages)

            # We can add a task to trigger a PATCH request
            dag.add_task(BashOperator(task_id="new_task", bash_command="date"))

            new_runner = AirflowLineageRunner(
                metadata=self.metadata,
                service_name=PIPELINE_SERVICE_NAME,
                dag=dag,
                xlets=get_xlets_from_dag(dag),
                only_keep_dag_lineage=True,
            )

            with self.assertLogs(level="INFO") as log:
                new_runner.execute()
                messages = get_captured_log_messages(log)
                self.assertIn("Updating Pipeline Entity from DAG...", messages)

            pipeline: Pipeline = self.metadata.get_by_name(
                entity=Pipeline,
                fqn=f"{PIPELINE_SERVICE_NAME}.test_runner",
                fields=["tasks"],
            )
            self.assertEqual(len(pipeline.tasks), 3)
