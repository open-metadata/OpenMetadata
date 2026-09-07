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
Validate that the OpenMetadata Lineage Operator ingests a DAG run and its inlets/outlets.

The DAG, the Airflow connection and the OpenMetadata entities are all created here, so the
suite depends on nothing beyond a reachable OpenMetadata server.
"""

import time
from datetime import datetime, timezone

import pytest
import requests

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline, StatusType
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.pipelineService import PipelineService

from ..integration_base import get_create_service
from .conftest import OM_CONNECTION_ID

DAG_ID = "lineage_tutorial_operator"
DAG_DESCRIPTION = "A simple tutorial DAG"
PIPELINE_SERVICE_NAME = "airflow_lineage_op_service"

DB_SERVICE_NAME = "test-service-table-lineage"
DATABASE_NAME = "test-db"
SCHEMA_NAME = "test-schema"
INLET_NAMES = ("lineage-test-inlet", "lineage-test-inlet2")
OUTLET_NAME = "lineage-test-outlet"
SCHEMA_FQN = f"{DB_SERVICE_NAME}.{DATABASE_NAME}.{SCHEMA_NAME}"

DAG_SOURCE = f'''
"""DAG owned by tests/integration/airflow/test_airflow_lineage.py."""
from datetime import datetime, timedelta

from airflow import DAG
from airflow.providers.standard.operators.bash import BashOperator

from airflow_provider_openmetadata.hooks.openmetadata import OpenMetadataHook
from airflow_provider_openmetadata.lineage.operator import OpenMetadataLineageOperator

with DAG(
    "{DAG_ID}",
    default_args={{"owner": "openmetadata", "retries": 0, "retry_delay": timedelta(seconds=5)}},
    description="{DAG_DESCRIPTION}",
    schedule=None,
    is_paused_upon_creation=True,
    start_date=datetime(2021, 1, 1),
    catchup=False,
) as dag:
    print_date = BashOperator(
        task_id="print_date",
        bash_command="date",
        outlets=[{{"tables": ["{SCHEMA_FQN}.{OUTLET_NAME}"]}}],
    )

    sleep = BashOperator(
        task_id="sleep",
        bash_command="sleep 1",
        inlets=[{{"tables": ["{SCHEMA_FQN}.{INLET_NAMES[0]}", "{SCHEMA_FQN}.{INLET_NAMES[1]}"]}}],
    )

    templated = BashOperator(
        task_id="templated",
        bash_command='echo "{{{{ ds }}}}"',
    )

    lineage_op = OpenMetadataLineageOperator(
        task_id="lineage_op",
        server_config=OpenMetadataHook("{OM_CONNECTION_ID}").get_conn(),
        service_name="{PIPELINE_SERVICE_NAME}",
        only_keep_dag_lineage=True,
    )

    print_date >> [sleep, templated] >> lineage_op
'''


def _task_status(pipeline: Pipeline, name: str):
    return next(
        (
            status.executionStatus
            for status in pipeline.pipelineStatus.taskStatus
            if status.name == name
        ),
        None,
    )


@pytest.fixture(scope="module")
def om_entities(metadata):
    """The database service, schema and tables the DAG declares as inlets and outlets."""
    service = metadata.create_or_update(
        data=get_create_service(entity=DatabaseService, name=DB_SERVICE_NAME)
    )
    database = metadata.create_or_update(
        data=CreateDatabaseRequest(
            name=DATABASE_NAME, service=service.fullyQualifiedName
        )
    )
    db_schema = metadata.create_or_update(
        data=CreateDatabaseSchemaRequest(
            name=SCHEMA_NAME, database=database.fullyQualifiedName
        )
    )

    tables = {}
    for table_name in (*INLET_NAMES, OUTLET_NAME):
        tables[table_name] = metadata.create_or_update(
            data=CreateTableRequest(
                name=table_name,
                databaseSchema=db_schema.fullyQualifiedName,
                columns=[Column(name="id", dataType=DataType.BIGINT)],
            )
        )

    yield tables

    metadata.delete(
        entity=DatabaseService, entity_id=service.id, recursive=True, hard_delete=True
    )
    pipeline_service = metadata.get_by_name(
        entity=PipelineService, fqn=PIPELINE_SERVICE_NAME
    )
    if pipeline_service:
        metadata.delete(
            entity=PipelineService,
            entity_id=pipeline_service.id,
            recursive=True,
            hard_delete=True,
        )


@pytest.fixture(scope="module")
def registered_dag(
    airflow_container, airflow_dag_dir, airflow_api, airflow_headers, om_entities
):
    """DAG_ID, once the dag-processor has picked the file up."""
    dag_file = airflow_dag_dir / f"{DAG_ID}.py"
    dag_file.write_text(DAG_SOURCE)
    dag_file.chmod(0o644)

    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        response = requests.get(
            f"{airflow_api}/dags/{DAG_ID}", headers=airflow_headers, timeout=30
        )
        if response.status_code == 200:
            return DAG_ID
        time.sleep(5)

    errors = requests.get(
        f"{airflow_api}/importErrors", headers=airflow_headers, timeout=30
    )
    # An empty importErrors list means the processor never read the file at all, so show
    # it what it can actually see in the mount.
    listing = airflow_container.exec("ls -la /opt/airflow/dags")
    raise TimeoutError(
        f"{DAG_ID} never registered.\nImport errors: {errors.text}\n"
        f"Container view of /opt/airflow/dags:\n{listing.output.decode(errors='replace')}"
    )


@pytest.fixture(scope="module")
def dag_run(airflow_api, airflow_headers, registered_dag):
    """A finished run of the lineage DAG."""
    unpause = requests.patch(
        f"{airflow_api}/dags/{registered_dag}",
        json={"is_paused": False},
        headers=airflow_headers,
        timeout=30,
    )
    assert (
        unpause.status_code == 200
    ), f"Could not unpause {registered_dag}: {unpause.text}"

    triggered = requests.post(
        f"{airflow_api}/dags/{registered_dag}/dagRuns",
        json={"logical_date": datetime.now(timezone.utc).isoformat()},
        headers=airflow_headers,
        timeout=30,
    )
    assert triggered.status_code in (
        200,
        201,
    ), f"Could not trigger {registered_dag}: {triggered.text}"
    run_id = triggered.json()["dag_run_id"]

    deadline = time.monotonic() + 300
    state = "queued"
    while state not in ("success", "failed") and time.monotonic() < deadline:
        time.sleep(5)
        response = requests.get(
            f"{airflow_api}/dags/{registered_dag}/dagRuns/{run_id}",
            headers=airflow_headers,
            timeout=30,
        )
        state = response.json().get("state")

    assert state in (
        "success",
        "failed",
    ), f"{registered_dag} did not finish in time. Last state: {state}"

    return run_id


def test_pipeline_created(metadata, dag_run):
    assert (
        metadata.get_by_name(entity=PipelineService, fqn=PIPELINE_SERVICE_NAME)
        is not None
    )

    pipeline = metadata.get_by_name(
        entity=Pipeline,
        fqn=f"{PIPELINE_SERVICE_NAME}.{DAG_ID}",
        fields=["tasks", "pipelineStatus"],
    )

    assert pipeline is not None
    assert {task.name for task in pipeline.tasks} == {
        "print_date",
        "sleep",
        "templated",
        "lineage_op",
    }
    assert pipeline.description.root == DAG_DESCRIPTION
    assert (
        pipeline.pipelineStatus is not None
    ), "Pipeline status should be collected via REST API"
    assert _task_status(pipeline, "print_date") == StatusType.Successful
    assert _task_status(pipeline, "sleep") == StatusType.Successful
    assert _task_status(pipeline, "templated") == StatusType.Successful


def test_pipeline_lineage(metadata, om_entities, dag_run):
    outlet_id = str(om_entities[OUTLET_NAME].id.root)

    for inlet_name in INLET_NAMES:
        lineage = metadata.get_lineage_by_name(
            entity=Table, fqn=f"{SCHEMA_FQN}.{inlet_name}"
        )

        assert {node["name"] for node in lineage.get("nodes") or []} == {OUTLET_NAME}
        assert len(lineage.get("downstreamEdges")) == 1
        assert lineage["downstreamEdges"][0]["toEntity"] == outlet_id
        assert (
            lineage["downstreamEdges"][0]["lineageDetails"]["pipeline"][
                "fullyQualifiedName"
            ]
            == f"{PIPELINE_SERVICE_NAME}.{DAG_ID}"
        )
