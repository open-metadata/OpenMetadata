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
Regression tests for ``build_dag`` (issue #28500).

``build_dag`` must NOT rely on Airflow 3.x's ``DagContext`` autoregister context
manager. That context manager keeps a process-global
``current_autoregister_module_name`` and, on ``DAG.__exit__`` -> ``DagContext.pop()``,
dereferences ``sys.modules[current_autoregister_module_name]``. When multiple DAG
files are parsed concurrently in the same process that global gets clobbered and the
referenced module may already be evicted from ``sys.modules``, raising a ``KeyError``.

Building the DAG with an explicit ``dag=`` reference (instead of ``with DAG(...)``)
bypasses ``DagContext`` entirely, so these tests assert both that the task attaches
correctly and that a poisoned ``DagContext`` no longer breaks the build.
"""

import uuid

import pytest

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    AirflowConfig,
    IngestionPipeline,
    PipelineType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Sink,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from openmetadata_managed_apis.workflows.ingestion.common import build_dag

TASK_NAME = "ingestion_task"


def _noop_workflow_fn(*_, **__):
    return None


def _server_config() -> OpenMetadataConnection:
    return OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(jwtToken="x.y.z"),
    )


def _ingestion_pipeline(name: str) -> IngestionPipeline:
    return IngestionPipeline(
        name=name,
        pipelineType=PipelineType.metadata,
        fullyQualifiedName=f"svc.{name}",
        sourceConfig=SourceConfig(config=DatabaseServiceMetadataPipeline()),
        openMetadataServerConnection=_server_config(),
        airflowConfig=AirflowConfig(),
        service=EntityReference(id=str(uuid.uuid4()), type="databaseService", name="svc"),
    )


def _workflow_config(name: str) -> OpenMetadataWorkflowConfig:
    return OpenMetadataWorkflowConfig(
        source=Source(
            type="mysql",
            serviceName="svc",
            sourceConfig=SourceConfig(config=DatabaseServiceMetadataPipeline()),
        ),
        sink=Sink(type="metadata-rest", config={}),
        workflowConfig=WorkflowConfig(openMetadataServerConfig=_server_config()),
        ingestionPipelineFQN=f"svc.{name}",
    )


def _build(name: str):
    return build_dag(
        task_name=TASK_NAME,
        ingestion_pipeline=_ingestion_pipeline(name),
        workflow_config=_workflow_config(name),
        workflow_fn=_noop_workflow_fn,
    )


def test_build_dag_attaches_task():
    dag = _build("attach_dag")

    assert dag.dag_id == "attach_dag"
    assert len(dag.tasks) == 1
    assert TASK_NAME in dag.task_dict
    assert dag.task_dict[TASK_NAME].dag is dag


def test_build_dag_survives_poisoned_dag_context():
    """
    Simulate the concurrent-parse race deterministically: point the process-global
    autoregister module name at a module that is not in ``sys.modules``. Before the
    fix this raised ``KeyError`` on ``with DAG(...) as dag:`` __exit__; the explicit
    ``dag=`` build must be immune to it.
    """
    dag_context = pytest.importorskip("airflow.sdk.definitions._internal.contextmanager").DagContext

    if not hasattr(dag_context, "current_autoregister_module_name"):
        pytest.skip("DagContext autoregister not present on this Airflow version")

    original = dag_context.current_autoregister_module_name
    dag_context.current_autoregister_module_name = f"missing_module_{uuid.uuid4().hex}"
    try:
        dag = _build("poisoned_dag")
    finally:
        dag_context.current_autoregister_module_name = original

    assert dag.dag_id == "poisoned_dag"
    assert TASK_NAME in dag.task_dict


def test_build_dag_does_not_use_dag_context_stack():
    dag_context = pytest.importorskip("airflow.sdk.definitions._internal.contextmanager").DagContext

    _build("stack_dag")

    assert dag_context.get_current_dag() is None
