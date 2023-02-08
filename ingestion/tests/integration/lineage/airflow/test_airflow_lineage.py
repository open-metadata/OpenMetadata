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
Test airflow lineage operator and hook.

This test is coupled with the example DAG `lineage_tutorial_operator`.

With the `docker compose up` setup, you can debug the progress
by setting breakpoints in this file.
"""
import time
from datetime import datetime, timedelta
from typing import Optional
from unittest import TestCase

import pytest
import requests

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.pipeline import Pipeline, StatusType
from metadata.generated.schema.entity.data.table import Column, DataType, Table
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
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata

OM_HOST_PORT = "http://localhost:8585/api"
OM_JWT = "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
AIRFLOW_HOST_API_ROOT = "http://localhost:8080/api/v1/"
DEFAULT_OM_AIRFLOW_CONNECTION = "openmetadata_conn_id"
DEFAULT_AIRFLOW_HEADERS = {
    "Content-Type": "application/json",
    "Authorization": "Basic YWRtaW46YWRtaW4=",
}
OM_LINEAGE_DAG_NAME = "lineage_tutorial_operator"
PIPELINE_SERVICE_NAME = "airflow_lineage_op_service"


def get_task_status_type_by_name(pipeline: Pipeline, name: str) -> Optional[StatusType]:
    """
    Given a pipeline, get its status by name
    """
    return next(
        (
            status.executionStatus
            for status in pipeline.pipelineStatus.taskStatus
            if status.name == name
        ),
        None,
    )


class AirflowLineageTest(TestCase):
    """
    This test will trigger an Airflow DAG and validate that the
    OpenMetadata Lineage Operator can properly handle the
    metadata ingestion and processes inlets and outlets.
    """

    server_config = OpenMetadataConnection(
        hostPort=OM_HOST_PORT,
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(jwtToken=OM_JWT),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    service = CreateDatabaseServiceRequest(
        name="test-service-table-lineage",
        serviceType=DatabaseServiceType.Mysql,
        connection=DatabaseConnection(
            config=MysqlConnection(
                username="username",
                password="password",
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

        schema_reference = EntityReference(
            id=create_schema_entity.id, name="test-schema", type="databaseSchema"
        )

        create_inlet = CreateTableRequest(
            name="lineage-test-inlet",
            databaseSchema=schema_reference,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        create_outlet = CreateTableRequest(
            name="lineage-test-outlet",
            databaseSchema=schema_reference,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.table_inlet = cls.metadata.create_or_update(data=create_inlet)
        cls.table_outlet = cls.metadata.create_or_update(data=create_outlet)

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn="test-service-table-lineage"
            ).id.__root__
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
            ).id.__root__
        )

        cls.metadata.delete(
            entity=PipelineService,
            entity_id=pipeline_service_id,
            recursive=True,
            hard_delete=True,
        )

    @pytest.mark.order(1)
    def test_dag_runs(self) -> None:
        """
        Trigger the Airflow DAG and wait until it runs.

        Note that the DAG definition is in examples/airflow_lineage_operator.py
        and it is expected to fail. This will allow us to validate
        the task status afterward.
        """

        # 1. Validate that the OpenMetadata connection exists
        res = requests.get(
            AIRFLOW_HOST_API_ROOT + f"connections/{DEFAULT_OM_AIRFLOW_CONNECTION}",
            headers=DEFAULT_AIRFLOW_HEADERS,
        )
        if res.status_code != 200:
            raise RuntimeError(
                f"Could not fetch {DEFAULT_OM_AIRFLOW_CONNECTION} connection"
            )

        # 2. Enable the DAG
        res = requests.patch(
            AIRFLOW_HOST_API_ROOT + f"dags/{OM_LINEAGE_DAG_NAME}",
            json={"is_paused": False},
            headers=DEFAULT_AIRFLOW_HEADERS,
        )
        if res.status_code != 200:
            raise RuntimeError(f"Could not enable {OM_LINEAGE_DAG_NAME} DAG")

        # 3. Trigger the DAG
        res = requests.post(
            AIRFLOW_HOST_API_ROOT + f"dags/{OM_LINEAGE_DAG_NAME}/dagRuns",
            json={
                # the start_date of the dag is 2021-01-01 "2019-08-24T14:15:22Z"
                "logical_date": datetime.strftime(
                    datetime.now() - timedelta(hours=1), "%Y-%m-%dT%H:%M:%SZ"
                ),
            },
            headers=DEFAULT_AIRFLOW_HEADERS,
        )
        if res.status_code != 200:
            raise RuntimeError(f"Could not trigger {OM_LINEAGE_DAG_NAME} DAG")
        dag_run_id = res.json()["dag_run_id"]

        # 4. Wait until the DAG is flagged as `successful`
        state = "queued"
        tries = 0
        while state != "success" and tries <= 5:
            tries += 1
            time.sleep(5)

            res = requests.get(
                AIRFLOW_HOST_API_ROOT
                + f"dags/{OM_LINEAGE_DAG_NAME}/dagRuns/{dag_run_id}",
                headers=DEFAULT_AIRFLOW_HEADERS,
            )
            state = res.json().get("state")

        if state != "success":
            raise RuntimeError(f"DAG {OM_LINEAGE_DAG_NAME} has not finished on time.")

    @pytest.mark.order(2)
    def test_pipeline_created(self) -> None:
        """
        Validate that the pipeline has been created
        """
        pipeline_service: PipelineService = self.metadata.get_by_name(
            entity=PipelineService, fqn=PIPELINE_SERVICE_NAME
        )
        self.assertIsNotNone(pipeline_service)

        pipeline: Pipeline = self.metadata.get_by_name(
            entity=Pipeline,
            fqn=f"{PIPELINE_SERVICE_NAME}.{OM_LINEAGE_DAG_NAME}",
            fields=["tasks", "pipelineStatus"],
        )
        self.assertIsNotNone(pipeline)

        expected_task_names = set((task.name for task in pipeline.tasks))
        self.assertEqual(
            expected_task_names, {"print_date", "sleep", "templated", "lineage_op"}
        )

        self.assertEqual(pipeline.description.__root__, "A simple tutorial DAG")

        # Validate status
        self.assertEqual(
            get_task_status_type_by_name(pipeline, "print_date"), StatusType.Successful
        )
        self.assertEqual(
            get_task_status_type_by_name(pipeline, "sleep"), StatusType.Successful
        )
        self.assertEqual(
            get_task_status_type_by_name(pipeline, "templated"), StatusType.Successful
        )

    @pytest.mark.order(3)
    def test_pipeline_lineage(self) -> None:
        """
        Validate that the pipeline has proper lineage
        """
        lineage = self.metadata.get_lineage_by_name(
            entity=Table,
            fqn="test-service-table-lineage.test-db.test-schema.lineage-test-inlet",
        )
        node_names = set((node["name"] for node in lineage.get("nodes") or []))
        self.assertEqual(node_names, {"lineage-test-outlet"})
        self.assertEqual(len(lineage.get("downstreamEdges")), 1)
        self.assertEqual(
            lineage["downstreamEdges"][0]["toEntity"],
            str(self.table_outlet.id.__root__),
        )
        self.assertEqual(
            lineage["downstreamEdges"][0]["lineageDetails"]["pipeline"][
                "fullyQualifiedName"
            ],
            f"{PIPELINE_SERVICE_NAME}.{OM_LINEAGE_DAG_NAME}",
        )
