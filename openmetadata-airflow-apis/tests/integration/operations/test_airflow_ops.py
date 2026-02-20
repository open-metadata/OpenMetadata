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

if "AIRFLOW_HOME" not in os.environ:
    os.environ["AIRFLOW_HOME"] = "/tmp/airflow"
if "AIRFLOW__OPENMETADATA_AIRFLOW_APIS__DAG_GENERATED_CONFIGS" not in os.environ:
    os.environ[
        "AIRFLOW__OPENMETADATA_AIRFLOW_APIS__DAG_GENERATED_CONFIGS"
    ] = "/tmp/airflow"
if "AIRFLOW__OPENMETADATA_AIRFLOW_APIS__DAG_RUNNER_TEMPLATE" not in os.environ:
    template_path = (
        Path(__file__).parent.parent.parent.parent
        / "openmetadata_managed_apis/resources/dag_runner.j2"
    )
    if not template_path.exists():
        template_path = (
            Path(__file__).parent.parent.parent.parent
            / "src/plugins/dag_templates/dag_runner.j2"
        )
    os.environ["AIRFLOW__OPENMETADATA_AIRFLOW_APIS__DAG_RUNNER_TEMPLATE"] = str(
        template_path.absolute()
    )

from airflow import DAG
from airflow.models import DagBag, DagModel
from airflow.models.serialized_dag import SerializedDagModel
from airflow.serialization.serialized_objects import LazyDeserializedDAG
from airflow.utils import timezone
from airflow.utils.state import DagRunState
from airflow.utils.types import DagRunType

try:
    from airflow.providers.standard.operators.bash import BashOperator
except ImportError:
    from airflow.operators.bash import BashOperator
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
        hostPort=os.getenv("OPENMETADATA_HOST_PORT", "http://localhost:8585/api"),
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
        # Initialize Airflow database if it doesn't exist
        from airflow.utils.db import initdb

        try:
            initdb()
        except Exception:
            # Database might already be initialized
            pass

        with DAG(
            "dag_status",
            description="A lineage test DAG",
            schedule=datetime.timedelta(days=1),
            start_date=datetime.datetime(2021, 1, 1),
        ) as cls.dag:
            BashOperator(  # Using BashOperator as a random example
                task_id="task1",
                bash_command="date",
            )

        if hasattr(cls.dag, "sync_to_db"):
            cls.dag.sync_to_db()
        else:
            from airflow.models.dag import DagModel
            from airflow.utils.session import create_session

            with create_session() as session:
                from airflow.models.dagbundle import DagBundleModel

                bundle = (
                    session.query(DagBundleModel)
                    .filter(DagBundleModel.name == "")
                    .first()
                )
                if not bundle:
                    bundle = DagBundleModel(name="", version=None)
                    session.add(bundle)
                    session.flush()

                dag_model = DagModel()
                dag_model.dag_id = cls.dag.dag_id
                dag_model.fileloc = cls.dag.fileloc
                dag_model.is_active = True
                dag_model.bundle_name = ""
                session.merge(dag_model)
                session.commit()

        cls.dagbag = DagBag(include_examples=False)

        # In Airflow 2.x, bag_dag() requires root_dag parameter
        # In Airflow 3.x, it doesn't accept root_dag parameter
        import inspect

        bag_dag_sig = inspect.signature(cls.dagbag.bag_dag)
        if "root_dag" in bag_dag_sig.parameters:
            # Airflow 2.x
            cls.dagbag.bag_dag(dag=cls.dag, root_dag=cls.dag)
        else:
            # Airflow 3.x
            cls.dagbag.bag_dag(cls.dag)

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """
        try:
            service = cls.metadata.get_by_name(
                entity=DatabaseService, fqn="test-service-ops"
            )
            if service:
                service_id = str(service.id.root)
                cls.metadata.delete(
                    entity=DatabaseService,
                    entity_id=service_id,
                    recursive=True,
                    hard_delete=True,
                )
        except Exception:
            pass

        if hasattr(cls, "_temp_dag_file") and cls._temp_dag_file.exists():
            cls._temp_dag_file.unlink()

        if os.path.exists("/tmp/airflow"):
            shutil.rmtree("/tmp/airflow")

    def test_dag_status(self):
        """
        Validate:
            - DAG with no status
            - DAG with a single status
            - DAG with multiple status
            - Missing DAG
        """

        from airflow.models import DagRun
        from airflow.utils.session import create_session

        # Ensure a clean slate in case previous tests populated `dag_status`
        with create_session() as session:
            session.query(DagRun).filter(DagRun.dag_id == self.dag.dag_id).delete()
            session.commit()

        res = status(dag_id="random")

        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json, {"error": "DAG random not found."})

        res = status(dag_id="dag_status")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json, [])

        with create_session() as session:
            now = timezone.utcnow()
            dr1 = DagRun(
                dag_id=self.dag.dag_id,
                run_id=f"manual__{now.isoformat()}",
                run_type=DagRunType.MANUAL,
                state=DagRunState.RUNNING,
                logical_date=now,
            )
            session.add(dr1)
            session.commit()

        res = status(dag_id="dag_status")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json[0].get("pipelineState"), "running")

        with create_session() as session:
            now2 = timezone.utcnow()
            dr2 = DagRun(
                dag_id=self.dag.dag_id,
                run_id=f"manual__{now2.isoformat()}_2",
                run_type=DagRunType.MANUAL,
                state=DagRunState.SUCCESS,
                logical_date=now2,
            )
            session.add(dr2)
            session.commit()

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

        from airflow.configuration import conf as airflow_conf

        dags_folder = airflow_conf.get("core", "DAGS_FOLDER")
        dag_file = Path(dags_folder) / "my_new_dag.py"
        self.assertTrue(dag_file.is_file())

        # Manually register a lightweight DAG since the scheduler might take time to pick it up
        dag_id = "my_new_dag"
        stub_dag = DAG(
            dag_id=dag_id,
            schedule=None,
            start_date=timezone.utcnow(),
            catchup=False,
        )
        stub_dag.fileloc = str(dag_file)

        try:
            from airflow.operators.empty import EmptyOperator
        except ImportError:
            from airflow.operators.dummy import DummyOperator as EmptyOperator

        EmptyOperator(task_id="noop", dag=stub_dag)
        from airflow.models.dagbundle import DagBundleModel
        from airflow.utils.session import create_session

        with create_session() as session:
            bundle = (
                session.query(DagBundleModel).filter(DagBundleModel.name == "").first()
            )
            if not bundle:
                bundle = DagBundleModel(name="", version=None)
                session.add(bundle)
                session.commit()

        dag_model = DagModel.get_current(dag_id)
        if not dag_model:
            with create_session() as session:
                dag_model_obj = DagModel(
                    dag_id=dag_id,
                    fileloc=str(dag_file),
                    bundle_name="",
                    bundle_version=None,
                )
                dag_model_obj.is_paused = False
                session.merge(dag_model_obj)
                session.commit()
                dag_model = dag_model_obj

        serialized_stub = LazyDeserializedDAG.from_dag(stub_dag)
        SerializedDagModel.write_dag(
            serialized_stub, bundle_name="", bundle_version=None
        )

        self.assertIsNotNone(dag_model)

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
