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
Regression tests for ``build_dag_configs`` start_date on Airflow 3 (issue #32505).

On Airflow 3, ``build_dag_configs`` used to set ``start_date = timezone.utcnow()``.
``build_dag_configs`` runs on every DAG-processor reparse (not just on first
creation), so that value was recomputed to a new "now" on every reparse. A cron
schedule only fires once its interval, measured from start_date, has elapsed --
with start_date perpetually reset to "now" the interval never elapses and the
DAG never fires on its own schedule, even though it deploys and shows up fine.

The fix anchors start_date on the pipeline's own ``updatedAt`` instead of wall
clock "now": it stays stable across reparses of the same, unchanged pipeline
config (so the interval can elapse), while still resetting close to "now"
whenever the pipeline is genuinely (re)configured -- which is what the original
"avoid an immediate catch-up run for a freshly (re)created pipeline" intent
required in the first place.
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
from metadata.generated.schema.metadataIngestion.workflow import SourceConfig
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.basic import Timestamp
from metadata.generated.schema.type.entityReference import EntityReference
from openmetadata_managed_apis.utils.airflow_version import is_airflow_3_or_higher
from openmetadata_managed_apis.workflows.ingestion.common import build_dag_configs

if not is_airflow_3_or_higher():
    pytest.skip("start_date anchoring only applies on Airflow 3+", allow_module_level=True)


def _server_config() -> OpenMetadataConnection:
    return OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(jwtToken="x.y.z"),
    )


def _ingestion_pipeline(name: str, updated_at_ms: int | None) -> IngestionPipeline:
    return IngestionPipeline(
        name=name,
        pipelineType=PipelineType.metadata,
        fullyQualifiedName=f"svc.{name}",
        sourceConfig=SourceConfig(config=DatabaseServiceMetadataPipeline()),
        openMetadataServerConnection=_server_config(),
        airflowConfig=AirflowConfig(scheduleInterval="0 0 * * *"),
        service=EntityReference(id=str(uuid.uuid4()), type="databaseService", name="svc"),
        updatedAt=Timestamp(root=updated_at_ms) if updated_at_ms is not None else None,
    )


def test_start_date_is_stable_across_reparses_of_the_same_pipeline():
    """
    The core regression: build_dag_configs is called once per DAG-processor
    reparse of an *unchanged* pipeline. Two such calls must produce the exact
    same start_date, or the cron interval measured from it never elapses.
    """
    pipeline = _ingestion_pipeline("stable_dag", updated_at_ms=1_700_000_000_000)

    first = build_dag_configs(pipeline)
    second = build_dag_configs(pipeline)

    assert first["start_date"] == second["start_date"]


def test_start_date_tracks_pipeline_updated_at():
    """start_date is anchored on the pipeline's updatedAt, not wall-clock now."""
    updated_at_ms = 1_700_000_000_000  # 2023-11-14T22:13:20Z

    configs = build_dag_configs(_ingestion_pipeline("anchored_dag", updated_at_ms=updated_at_ms))

    assert configs["start_date"].int_timestamp == updated_at_ms // 1000


def test_start_date_falls_back_to_now_without_updated_at():
    """
    A pipeline with no updatedAt yet (e.g. not fully round-tripped through the
    server) falls back to the pre-fix "now" behavior rather than erroring out.
    """
    from airflow.utils import timezone

    before = timezone.utcnow()
    configs = build_dag_configs(_ingestion_pipeline("no_updated_at_dag", updated_at_ms=None))
    after = timezone.utcnow()

    assert before <= configs["start_date"] <= after
