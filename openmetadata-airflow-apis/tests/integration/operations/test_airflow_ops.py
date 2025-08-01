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
Test Airflow related operations
"""
import datetime
import os
import shutil
import time
import uuid
from pathlib import Path
from unittest import TestCase

# We need to patch the environment before importing Airflow
# At module load it already inits the configurations.
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
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
from metadata.generated.schema.type.basic import Markdown
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata

os.environ["AIRFLOW_HOME"] = "/tmp/airflow"
os.environ[
    "AIRFLOW__DATABASE__SQL_ALCHEMY_CONN"
] = "mysql+pymysql://airflow_user:airflow_pass@localhost/airflow_db"
os.environ["AIRFLOW__OPENMETADATA_AIRFLOW_APIS__DAG_GENERATED_CONFIGS"] = "/tmp/airflow"
os.environ["AIRFLOW__OPENMETADATA_AIRFLOW_APIS__DAG_RUNNER_TEMPLATE"] = str(
    (
        Path(__file__).parent.parent.parent.parent
        / "src/plugins/dag_templates/dag_runner.j2"
    ).absolute()
)

from airflow import DAG
from airflow.models import DagBag, DagModel
from airflow.operators.bash import BashOperator
from airflow.utils import timezone
from airflow.utils.state import DagRunState
from airflow.utils.types import DagRunType
from openmetadata_managed_apis.operations.delete import delete_dag_id
from openmetadata_managed_apis.operations.deploy import DagDeployer
from openmetadata_managed_apis.operations.kill_all import kill_all
from openmetadata_managed_apis.operations.state import disable_dag, enable_dag
from openmetadata_managed_apis.operations.status import status
from openmetadata_managed_apis.operations.trigger import trigger

from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)


class TestAirflowOps(TestCase):
    dagbag: DagBag
    dag: DAG

    conn = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(conn)

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """

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
            ).id.root
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

        res = status(dag_id="random")

        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json, {"error": "DAG random not found."})

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
        self.assertEqual(res.json[0].get("pipelineState"), "running")

        self.dag.create_dagrun(
            run_type=DagRunType.MANUAL,
            state=DagRunState.SUCCESS,
            execution_date=timezone.utcnow(),
        )

        res = status(dag_id="dag_status")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json), 2)

        res = kill_all(dag_id="dag_status")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            res.json, {"message": f"Workflow [dag_status] has been killed"}
        )

        res = status(dag_id="dag_status")

        self.assertEqual(res.status_code, 200)

        res_status = {elem.get("pipelineState") for elem in res.json}
        self.assertEqual(res_status, {"failed", "success"})

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

    def test_dag_deploy_and_delete(self):
        """
        DAGs can be deployed
        """
        service = self.metadata.create_or_update(
            CreateDatabaseServiceRequest(
                name="test-service-ops",
                serviceType=DatabaseServiceType.Mysql,
                connection=DatabaseConnection(
                    config=MysqlConnection(
                        username="username",
                        authType=BasicAuth(
                            password="password",
                        ),
                        hostPort="http://localhost:1234",
                    )
                ),
            )
        )

        ingestion_pipeline = IngestionPipeline(
            id=uuid.uuid4(),
            pipelineType=PipelineType.metadata,
            name="my_new_dag",
            description=Markdown("A test DAG"),
            fullyQualifiedName="test-service-ops.my_new_dag",
            sourceConfig=SourceConfig(config=DatabaseServiceMetadataPipeline()),
            openMetadataServerConnection=self.conn,
            airflowConfig=AirflowConfig(),
            service=EntityReference(
                id=service.id, type="databaseService", name="test-service-ops"
            ),
        )

        # Create the DAG
        deployer = DagDeployer(ingestion_pipeline)
        res = deployer.deploy()

        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            res.json, {"message": "Workflow [my_new_dag] has been created"}
        )

        dag_file = Path("/tmp/airflow/dags/my_new_dag.py")
        self.assertTrue(dag_file.is_file())

        # Trigger it, waiting for it to be parsed by the scheduler
        dag_id = "my_new_dag"
        tries = 5
        dag_model = None
        while not dag_model and tries >= 0:
            dag_model = DagModel.get_current(dag_id)
            time.sleep(5)
            tries -= 1

        res = trigger(dag_id="my_new_dag", run_id=None)

        self.assertEqual(res.status_code, 200)
        self.assertIn("Workflow [my_new_dag] has been triggered", res.json["message"])

        # Delete it
        res = delete_dag_id("my_new_dag")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json, {"message": "DAG [my_new_dag] has been deleted"})

        self.assertFalse(dag_file.is_file())

        # Cannot find it anymore
        res = status(dag_id="my_new_dag")
        self.assertEqual(res.status_code, 404)
