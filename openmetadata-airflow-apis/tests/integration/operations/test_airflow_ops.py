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
import time
import uuid
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

import pytest
from sqlalchemy import (
    TEXT,
    Column,
    Date,
    DateTime,
    Integer,
    String,
    Time,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker

# We need to patch the environment before importing Airflow
# At module load it already inits the configurations.
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.automations.runQueryRequest import (
    QueryTypes,
    RunQueryRequest,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
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
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
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
from openmetadata_managed_apis.operations.run_sql_query import run_sql_query
from openmetadata_managed_apis.operations.state import disable_dag, enable_dag
from openmetadata_managed_apis.operations.status import status
from openmetadata_managed_apis.operations.trigger import trigger

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    comments = Column(TEXT)
    age = Column(Integer)
    dob = Column(DateTime)  # date of birth
    tob = Column(Time)  # time of birth
    doe = Column(Date)  # date of employment


class TestAirflowOps(TestCase):

    dagbag: DagBag
    dag: DAG

    conn = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )  # type: ignore
    metadata = OpenMetadata(conn)

    db_path = os.path.join(
        os.path.dirname(__file__), f"{os.path.splitext(__file__)[0]}.db"
    )

    service_conn = ServiceConnection(
        __root__=DatabaseConnection(
            config=SQLiteConnection(
                scheme=SQLiteScheme.sqlite_pysqlite,
                databaseMode=db_path + "?check_same_thread=False",
            )  # type: ignore
        )
    )

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

        cls.engine = create_engine(f"sqlite:///{cls.db_path}")

        User.__table__.create(bind=cls.engine)
        data = [
            User(
                name="John",
                fullname="John Doe",
                nickname="johnny b goode",
                comments="no comments",
                age=30,
                dob=datetime.datetime(1992, 5, 17),
                tob=datetime.time(11, 2, 32),
                doe=datetime.date(2020, 1, 12),
            ),
            User(
                name="Jane",
                fullname="Jone Doe",
                nickname=None,
                comments="maybe some comments",
                age=31,
                dob=datetime.datetime(1991, 4, 4),
                tob=datetime.time(10, 1, 31),
                doe=datetime.date(2009, 11, 11),
            ),
            User(
                name="John",
                fullname="John Doe",
                nickname=None,
                comments=None,
                age=None,
                dob=datetime.datetime(1982, 2, 2),
                tob=datetime.time(9, 3, 25),
                doe=datetime.date(2012, 12, 1),
            ),
        ]

        Session = sessionmaker()
        cls.session = Session(bind=cls.engine)

        with cls.session as sess:
            sess.add_all(data)
            sess.commit()

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """
        os.remove(cls.db_path)
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
                        password="password",
                        hostPort="http://localhost:1234",
                    )
                ),
            )
        )

        ingestion_pipeline = IngestionPipeline(
            id=uuid.uuid4(),
            pipelineType=PipelineType.metadata,
            name="my_new_dag",
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

    def test_run_sql_query(self):
        """Test run SQL query endpoint"""
        with patch(
            "openmetadata_managed_apis.operations.run_sql_query.get_service_connection",
            return_value=self.service_conn,
        ):
            resp = run_sql_query(
                RunQueryRequest(
                    serviceType="Database",
                    queryType=QueryTypes.RUN,
                    query="SELECT * FROM users",
                    serviceName="foo",
                    openMetadataServerConnection=self.conn,
                    offset=1,
                    limit=10,
                )
            )

            self.assertEqual(resp.status_code, 200)

            json_resp: dict = resp.json
            data = json_resp["data"]
            self.assertEqual(data["columnNames"], User.__table__.columns.keys())
            self.assertEqual(len(data["rowValues"]), 2)

            # test offset works as expected
            self.assertEqual(data["rowValues"][0][0], 2)
            self.assertEqual(data["rowValues"][1][0], 3)

            with pytest.raises(RuntimeError):
                resp = run_sql_query(
                    RunQueryRequest(
                        serviceType="Database",
                        queryType=QueryTypes.RUN,
                        query="DELETE users",
                        serviceName="foo",
                        openMetadataServerConnection=self.conn,
                        offset=1,
                        limit=10,
                    )
                )

            resp = run_sql_query(
                RunQueryRequest(
                    serviceType="Database",
                    queryType=QueryTypes.RUN,
                    query="Select * FROM FOO.users",
                    serviceName="foo",
                    openMetadataServerConnection=self.conn,
                    offset=1,
                    limit=10,
                )
            )

            self.assertEqual(resp.status_code, 400)
