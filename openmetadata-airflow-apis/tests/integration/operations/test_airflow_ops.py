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
Test Airflow related operations
"""
import datetime
import os
import shutil
import uuid
from pathlib import Path
from unittest import TestCase

# We need to patch the environment before importing Airflow
# At module load it already inits the configurations.
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    AirflowConfig,
    IngestionPipeline,
    PipelineType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import SourceConfig
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata

os.environ["AIRFLOW_HOME"] = "/tmp/airflow"
os.environ["AIRFLOW__CORE__SQL_ALCHEMY_CONN"] = "sqlite:////tmp/airflow/airflow.db"
os.environ["AIRFLOW__OPENMETADATA_AIRFLOW_APIS__DAG_GENERATED_CONFIGS"] = "/tmp/airflow"
os.environ["AIRFLOW__OPENMETADATA_AIRFLOW_APIS__DAG_RUNNER_TEMPLATE"] = str(
    (Path(__file__).parent.parent.parent.parent / "src/plugins/dag_templates/dag_runner.j2").absolute()
)


from airflow import DAG
from airflow.models import DagBag
from airflow.operators.bash import BashOperator
from airflow.utils import db, timezone
from airflow.utils.state import DagRunState
from airflow.utils.types import DagRunType
from openmetadata.operations.deploy import DagDeployer
from openmetadata.operations.state import disable_dag, enable_dag
from openmetadata.operations.status import status


class TestAirflowOps(TestCase):

    dagbag: DagBag
    dag: DAG

    conn = OpenMetadataConnection(
        hostPort="http://localhost:8585/api"
    )
    metadata = OpenMetadata(conn)

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """

        db.resetdb()
        db.initdb()

        with DAG(
                "dag_status",
                description="A lineage test DAG",
                schedule_interval=datetime.timedelta(days=1),
                start_date=datetime.datetime(2021, 1, 1),
        ) as cls.dag:
            BashOperator(  # Using BashOperator as a random example
                task_id="task1",
                bash_command="date",
            )

        cls.dag.sync_to_db()
        cls.dagbag = DagBag(include_examples=False)

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """
        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn="test-service-ops"
            ).id.__root__
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

        shutil.rmtree("/tmp/airflow")

    def test_dag_status(self):
        """
        Validate:
            - DAG with no status
            - DAG with a single status
            - DAG with multiple status
            - Missing DAG
        """

        res = status(dag_id="dag_status")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json, [])

        self.dag.create_dagrun(
            run_type=DagRunType.MANUAL,
            state=DagRunState.RUNNING,
            execution_date=timezone.utcnow(),
        )

        res = status(dag_id="dag_status")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json[0].get("state"), "running")

        self.dag.create_dagrun(
            run_type=DagRunType.MANUAL,
            state=DagRunState.SUCCESS,
            execution_date=timezone.utcnow(),
        )

        res = status(dag_id="dag_status")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json), 2)

        res = status(dag_id="random")

        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json, {"error": "DAG random not found."})

    def test_dag_state(self):
        """
        DAG can be enabled and disabled
        """

        res = enable_dag(dag_id="random")

        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json, {"error": "DAG random not found."})

        res = enable_dag(dag_id="dag_status")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json, {"message": "DAG dag_status has been enabled"})

        res = disable_dag(dag_id="dag_status")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json, {"message": "DAG dag_status has been disabled"})

    def test_dag_deploy(self):
        """
        DAGs can be deployed
        """
        service = self.metadata.create_or_update(CreateDatabaseServiceRequest(
            name="test-service-ops",
            serviceType=DatabaseServiceType.Mysql,
            connection=DatabaseConnection(
                config=MysqlConnection(
                    username="username",
                    password="password",
                    hostPort="http://localhost:1234",
                )
            ),
        ))

        ingestion_pipeline = IngestionPipeline(
            id=uuid.uuid4(),
            pipelineType=PipelineType.metadata,
            name="my_new_dag",
            sourceConfig=SourceConfig(
                config=DatabaseServiceMetadataPipeline()
            ),
            openMetadataServerConnection=self.conn,
            airflowConfig=AirflowConfig(),
            service=EntityReference(id=service.id, type="databaseService", name="test-service-ops")
        )

        deployer = DagDeployer(ingestion_pipeline, self.dagbag)
        res = deployer.deploy()

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json, {"message": "Workflow [my_new_dag] has been created"})

        dag_file = Path("/tmp/airflow/dags/my_new_dag.py")
        self.assertTrue(dag_file.is_file())


