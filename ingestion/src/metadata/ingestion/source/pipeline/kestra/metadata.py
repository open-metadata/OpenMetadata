#  Copyright 2025 Collate
#  Licensed under the Collate License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Kestra pipeline connector — ingests flows, executions, and lineage.
"""
import traceback
from datetime import datetime, timezone
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.pipeline.kestraConnection import (
    KestraConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
    Timestamp,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.kestra.models import KestraFlow
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Maps Kestra execution state strings to OpenMetadata StatusType values.
# Any state not listed here defaults to Pending.
KESTRA_STATUS_MAP = {
    "SUCCESS": StatusType.Successful.value,
    "FAILED": StatusType.Failed.value,
    "KILLED": StatusType.Failed.value,
    "RUNNING": StatusType.Pending.value,
    "CREATED": StatusType.Pending.value,
    "PAUSED": StatusType.Pending.value,
    "QUEUED": StatusType.Pending.value,
    "RESTARTED": StatusType.Pending.value,
    "KILLING": StatusType.Pending.value,
    "WARNING": StatusType.Successful.value,  # Terminal state: completed with warnings
}

# Label keys used on Kestra flows to declare lineage
LINEAGE_LABEL_INPUT = "openmetadata.table.input"
LINEAGE_LABEL_OUTPUT = "openmetadata.table.output"


def _parse_iso_to_ms(date_str: Optional[str]) -> Optional[int]:
    """
    Parse an ISO 8601 datetime string and return milliseconds since epoch.
    Returns None if the string is absent or unparseable.
    """
    if not date_str:
        return None
    try:
        # Handle both offset-aware and naive datetimes
        dt = datetime.fromisoformat(date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except Exception as exc:
        logger.debug(f"Could not parse date string '{date_str}': {exc}")
        return None


class KestraSource(PipelineServiceSource):
    """
    Ingests Kestra Flows as OpenMetadata Pipeline entities, along with
    execution status history and label-based lineage.
    """

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ) -> "KestraSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: KestraConnection = config.serviceConnection.root.config
        if not isinstance(connection, KestraConnection):
            raise InvalidSourceException(
                f"Expected KestraConnection, but got {connection}"
            )
        return cls(config, metadata)

    # ------------------------------------------------------------------ #
    # Pipeline discovery                                                   #
    # ------------------------------------------------------------------ #

    def get_pipelines_list(self) -> Iterable[KestraFlow]:
        """
        Iterate all namespaces and yield every KestraFlow found.
        Filtering by pipelineFilterPattern is handled by the base class
        via get_pipeline().
        """
        namespaces: List[str] = self.client.get_namespaces()
        if not namespaces:
            # Fall back to a global search when no namespaces are returned
            logger.debug(
                "No namespaces returned; falling back to global flow search."
            )
            yield from self.client.get_flows()
            return

        for namespace in namespaces:
            try:
                for flow in self.client.get_flows(namespace=namespace):
                    yield flow
            except Exception as exc:
                logger.warning(
                    f"Error fetching flows for namespace '{namespace}': {exc}"
                )

    def get_pipeline_name(self, pipeline_details: KestraFlow) -> str:
        """Return the unique pipeline name as '{namespace}.{flow_id}'."""
        return f"{pipeline_details.namespace}.{pipeline_details.id}"

    # ------------------------------------------------------------------ #
    # Pipeline entity creation                                             #
    # ------------------------------------------------------------------ #

    def yield_pipeline(
        self, pipeline_details: KestraFlow
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """Map a KestraFlow to a CreatePipelineRequest."""
        try:
            tasks: Optional[List[Task]] = None
            if pipeline_details.tasks:
                tasks = [
                    Task(
                        name=t.id,
                        displayName=t.id,
                    )
                    for t in pipeline_details.tasks
                ]

            host_port = str(self.service_connection.hostPort).rstrip("/")
            source_url = (
                f"{host_port}/ui/{pipeline_details.namespace}"
                f"/flows/edit/{pipeline_details.id}"
            )

            pipeline_request = CreatePipelineRequest(
                name=EntityName(
                    f"{pipeline_details.namespace}.{pipeline_details.id}"
                ),
                displayName=pipeline_details.id,
                description=(
                    Markdown(pipeline_details.description)
                    if pipeline_details.description
                    else None
                ),
                tasks=tasks,
                service=FullyQualifiedEntityName(
                    self.context.get().pipeline_service
                ),
                sourceUrl=SourceUrl(source_url),
            )
            yield Either(right=pipeline_request)
            self.register_record(pipeline_request=pipeline_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=self.get_pipeline_name(pipeline_details),
                    error=f"Error yielding pipeline for {pipeline_details}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    # ------------------------------------------------------------------ #
    # Execution status ingestion                                           #
    # ------------------------------------------------------------------ #

    def yield_pipeline_status(
        self, pipeline_details: KestraFlow
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """Yield one OMetaPipelineStatus per Kestra execution."""
        try:
            executions = self.client.get_executions(
                namespace=pipeline_details.namespace,
                flow_id=pipeline_details.id,
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=self.get_pipeline_name(pipeline_details),
                    error=f"Error fetching executions for {pipeline_details}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
            return

        pipeline_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.context.get().pipeline_service,
            pipeline_name=self.context.get().pipeline,
        )

        for execution in executions:
            try:
                status_value = KESTRA_STATUS_MAP.get(
                    execution.state.current, StatusType.Pending.value
                )
                timestamp_ms = _parse_iso_to_ms(execution.startDate)

                task_status = TaskStatus(
                    name=execution.id,
                    executionStatus=status_value,
                    startTime=Timestamp(timestamp_ms) if timestamp_ms else None,
                )
                pipeline_status = PipelineStatus(
                    executionStatus=status_value,
                    timestamp=Timestamp(timestamp_ms) if timestamp_ms else None,
                    taskStatus=[task_status],
                )
                yield Either(
                    right=OMetaPipelineStatus(
                        pipeline_fqn=pipeline_fqn,
                        pipeline_status=pipeline_status,
                    )
                )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=execution.id,
                        error=f"Error yielding status for execution {execution.id}: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    # ------------------------------------------------------------------ #
    # Lineage                                                              #
    # ------------------------------------------------------------------ #

    def yield_pipeline_lineage_details(
        self, pipeline_details: KestraFlow
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Derive lineage from Kestra flow labels.

        Kestra returns labels as a list of {key, value} objects.
        We look for two well-known keys:
          - openmetadata.table.input  → source table FQN (table → pipeline)
          - openmetadata.table.output → destination table FQN (pipeline → table)
        """
        labels = pipeline_details.get_labels_dict()
        input_fqn = labels.get(LINEAGE_LABEL_INPUT)
        output_fqn = labels.get(LINEAGE_LABEL_OUTPUT)

        if not input_fqn and not output_fqn:
            return

        # Resolve the pipeline entity
        pipeline_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.context.get().pipeline_service,
            pipeline_name=self.context.get().pipeline,
        )
        pipeline_entity = self.metadata.get_by_name(entity=Pipeline, fqn=pipeline_fqn)
        if not pipeline_entity:
            logger.debug(
                f"Pipeline entity not found for FQN '{pipeline_fqn}'; skipping lineage."
            )
            return

        pipeline_ref = EntityReference(
            id=pipeline_entity.id.root, type="pipeline"
        )
        lineage_details = LineageDetails(
            pipeline=pipeline_ref,
            source=LineageSource.PipelineLineage,
        )

        # Input label: table → pipeline
        if input_fqn:
            table = self.metadata.get_by_name(entity=Table, fqn=input_fqn)
            if table:
                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=table.id.root, type="table"
                            ),
                            toEntity=pipeline_ref,
                            lineageDetails=lineage_details,
                        )
                    )
                )
            else:
                logger.debug(
                    f"Could not resolve input table FQN '{input_fqn}' for flow "
                    f"'{pipeline_details.namespace}.{pipeline_details.id}'; skipping."
                )

        # Output label: pipeline → table
        if output_fqn:
            table = self.metadata.get_by_name(entity=Table, fqn=output_fqn)
            if table:
                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=pipeline_ref,
                            toEntity=EntityReference(
                                id=table.id.root, type="table"
                            ),
                            lineageDetails=lineage_details,
                        )
                    )
                )
            else:
                logger.debug(
                    f"Could not resolve output table FQN '{output_fqn}' for flow "
                    f"'{pipeline_details.namespace}.{pipeline_details.id}'; skipping."
                )
