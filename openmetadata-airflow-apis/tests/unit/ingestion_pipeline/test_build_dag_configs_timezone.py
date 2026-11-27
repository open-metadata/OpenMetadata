#  Copyright 2026 Collate
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
``build_dag_configs`` hands ``airflowConfig.pipelineTimezone`` to Airflow through the zone of
``start_date``: Airflow evaluates a cron schedule in the zone of a zone-aware start date, so a
pipeline scheduled at ``0 9 * * *`` in ``Europe/Berlin`` must not fire at 09:00 UTC.
"""

import uuid

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
from openmetadata_managed_apis.workflows.ingestion.common import build_dag_configs

UPDATED_AT_MS = 1_700_000_000_000  # 2023-11-14T22:13:20Z


def _ingestion_pipeline(name: str, timezone: str | None) -> IngestionPipeline:
    airflow_config = {"scheduleInterval": "0 9 * * *"}
    if timezone is not None:
        airflow_config["pipelineTimezone"] = timezone

    return IngestionPipeline(
        name=name,
        pipelineType=PipelineType.metadata,
        fullyQualifiedName=f"svc.{name}",
        sourceConfig=SourceConfig(config=DatabaseServiceMetadataPipeline()),
        openMetadataServerConnection=OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="openmetadata",
            securityConfig=OpenMetadataJWTClientConfig(jwtToken="x.y.z"),
        ),
        airflowConfig=AirflowConfig(**airflow_config),
        service=EntityReference(id=str(uuid.uuid4()), type="databaseService", name="svc"),
        updatedAt=Timestamp(root=UPDATED_AT_MS),
    )


def test_start_date_carries_the_pipeline_timezone():
    configs = build_dag_configs(_ingestion_pipeline("berlin_dag", "Europe/Berlin"))

    start_date = configs["start_date"]
    assert start_date.tzinfo.name == "Europe/Berlin"
    assert start_date.utcoffset().total_seconds() == 3600  # CET on 2023-11-14
    assert configs["schedule" if "schedule" in configs else "schedule_interval"] == "0 9 * * *"


def test_start_date_defaults_to_utc_without_a_timezone():
    configs = build_dag_configs(_ingestion_pipeline("utc_dag", None))

    assert configs["start_date"].tzinfo.name == "UTC"
    assert configs["start_date"].utcoffset().total_seconds() == 0
