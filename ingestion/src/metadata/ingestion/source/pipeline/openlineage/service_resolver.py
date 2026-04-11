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
Resolves the pipeline service type and name from OpenLineage event metadata.

OpenLineage events carry integration identity (Spark, Flink, Airflow, etc.)
in job facets. This module extracts that information and maps it to the
appropriate OMD PipelineServiceType, creating services as needed.
"""

from typing import Dict, Optional, Tuple

from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceRequest,
)
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.type.basic import EntityName
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.openlineage.models import OpenLineageEvent
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

INTEGRATION_TO_SERVICE_TYPE: Dict[str, PipelineServiceType] = {
    "spark": PipelineServiceType.Spark,
    "flink": PipelineServiceType.Flink,
    "airflow": PipelineServiceType.Airflow,
    "dbt": PipelineServiceType.DBTCloud,
    "dagster": PipelineServiceType.Dagster,
}

SERVICE_NAME_SUFFIX = "_openlineage"


def extract_integration_type(event: OpenLineageEvent) -> Optional[str]:
    """
    Extract the integration type from an OpenLineage event via the
    standard ``job.facets.jobType.integration`` field.

    Returns a lowercase string like "spark", "flink", "airflow", or None.
    """
    try:
        integration = event.job["facets"]["jobType"]["integration"]
        if integration:
            return integration.strip().lower()
    except (KeyError, TypeError, AttributeError):
        pass

    return None


def find_pipeline_by_namespace(
    metadata: OpenMetadata,
    event: OpenLineageEvent,
) -> Optional[Tuple[str, Pipeline]]:
    """
    Try to find an existing pipeline using ``namespace.jobName`` as FQN.

    When pipelines are ingested by native connectors (e.g. Airflow), the OL
    job namespace often matches the pipeline service name already present in
    OMD.  Checking this first avoids creating duplicate pipelines under a new
    service.

    Returns ``(service_name, pipeline_entity)`` on hit, or ``None``.
    """
    try:
        namespace = event.job.get("namespace")
        name = event.job.get("name")
    except (AttributeError, TypeError):
        return None

    if not namespace or not name:
        return None

    fallback_fqn = f"{namespace}.{name}"
    existing = metadata.get_by_name(Pipeline, fallback_fqn)
    if existing:
        logger.info(f"Resolved pipeline via namespace fallback: {fallback_fqn}")
        return namespace, existing

    return None


def resolve_pipeline_service_type(
    integration: Optional[str],
) -> PipelineServiceType:
    """Map an integration string to a PipelineServiceType enum."""
    if integration and integration in INTEGRATION_TO_SERVICE_TYPE:
        return INTEGRATION_TO_SERVICE_TYPE[integration]
    return PipelineServiceType.OpenLineage


def build_service_name(integration: Optional[str], fallback_service: str) -> str:
    """
    Build the pipeline service name.

    If integration is recognized, returns "{integration}_openlineage".
    Otherwise returns the fallback (the configured OpenLineage service name).
    """
    if integration and integration in INTEGRATION_TO_SERVICE_TYPE:
        return f"{integration}{SERVICE_NAME_SUFFIX}"
    return fallback_service


def get_or_create_pipeline_service(
    metadata: OpenMetadata,
    service_name: str,
    service_type: PipelineServiceType,
    _cache: Optional[Dict[str, str]] = None,
) -> str:
    """
    Ensure a PipelineService with the given name and type exists in OMD.

    Uses an external cache dict to avoid repeated API calls within a session.
    Returns the service name.
    """
    if _cache is not None and service_name in _cache:
        return _cache[service_name]

    existing = metadata.get_by_name(PipelineService, service_name)
    if existing:
        if _cache is not None:
            _cache[service_name] = service_name
        return service_name

    logger.info(
        f"Creating pipeline service '{service_name}' with type '{service_type.value}'"
    )
    request = CreatePipelineServiceRequest(
        name=EntityName(service_name),
        serviceType=service_type,
    )
    metadata.create_or_update(request)

    if _cache is not None:
        _cache[service_name] = service_name

    return service_name
