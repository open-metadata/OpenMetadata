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
Prefect connector for OpenMetadata.
Ingests flows, deployments, run history, and lineage from Prefect Cloud
or a self-hosted Prefect Server.
"""

from __future__ import annotations

import traceback
from datetime import datetime
from typing import TYPE_CHECKING

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
from metadata.generated.schema.entity.services.connections.pipeline.prefectConnection import (
    PrefectConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, SourceUrl
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.openlineage.models import TableDetails
from metadata.ingestion.source.pipeline.openlineage.utils import FQNNotFoundException
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

if TYPE_CHECKING:
    from collections.abc import Iterable

    from metadata.ingestion.models.ometa_classification import (
        OMetaTagAndClassification,
    )
    from metadata.ingestion.ometa.ometa_api import OpenMetadata
    from metadata.ingestion.source.pipeline.prefect.client import PrefectClient

logger = ingestion_logger()

PREFECT_TAG_CATEGORY = "PrefectTags"

# Map Prefect run states to OpenMetadata status types. An unrecognized state
# (including "UNKNOWN") defaults to Pending rather than Failed: seeing a state
# we don't understand is not evidence the run failed.
PREFECT_STATE_MAP = {
    "COMPLETED": StatusType.Successful,
    "FAILED": StatusType.Failed,
    "CRASHED": StatusType.Failed,
    "CANCELLED": StatusType.Failed,
    "RUNNING": StatusType.Pending,
    "PENDING": StatusType.Pending,
    "SCHEDULED": StatusType.Pending,
    "PAUSED": StatusType.Pending,
}


def _parse_timestamp(ts_str: str | None) -> int | None:
    """Convert an ISO timestamp string to a Unix timestamp in milliseconds."""
    if not ts_str:
        return None
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        return int(dt.timestamp() * 1000)
    except Exception:
        return None


def _stable_task_names(task_runs: list[dict]) -> dict[str, str]:
    """
    Map each task run's id to its task's stable name (``task_key``, not
    ``name`` — ``name`` carries a random suffix that's different on every
    run, ``task_key`` is the same across every run of the same task).

    A task called more than once in one run (e.g. inside a loop) shares one
    task_key across all those calls, so they all resolve to the same Task —
    same as a Pipeline stays one entity across many runs. Their executions
    aren't lost: each still gets its own ``TaskStatus`` entry (see
    ``_build_task_status``), just grouped under that one Task's name instead
    of inventing a separate Task per call.
    """
    return {t["id"]: t.get("task_key", t.get("name", t["id"])) for t in task_runs}


class PrefectSource(PipelineServiceSource):
    """
    Implements the necessary methods to extract pipeline metadata
    from Prefect flows.
    """

    client: PrefectClient

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ) -> PrefectSource:
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: PrefectConnection = config.serviceConnection.root.config
        if not isinstance(connection, PrefectConnection):
            raise InvalidSourceException(f"Expected PrefectConnection, got {connection}")
        return cls(config, metadata)

    def _build_task_dag(self, task_runs: list[dict]) -> list[Task]:
        # ponytail: temporary — builds Tasks straight from one flow run's task
        # runs, no merge with deployment tasks yet, just to check ingestion.
        # One Task per unique name (see _stable_task_names) — a task called
        # more than once in this run contributes one Task, not one per call.
        id_to_name = _stable_task_names(task_runs)
        downstream: dict[str, list[str]] = {name: [] for name in id_to_name.values()}
        for run in task_runs:
            this_name = id_to_name[run["id"]]
            for refs in (run.get("task_inputs") or {}).values():
                for ref in refs:
                    upstream_name = id_to_name.get(ref.get("id"))
                    if upstream_name and this_name not in downstream[upstream_name]:
                        downstream[upstream_name].append(this_name)
        return [
            Task(name=name, displayName=name, downstreamTasks=targets or None) for name, targets in downstream.items()
        ]

    def _get_all_tags(self, flow: dict, deployments: list[dict]) -> list[str]:
        """
        Collect all unique tags from flow and its deployments.
        In Prefect 3.x, tags can be on flows or deployments.
        """
        all_tags = set(flow.get("tags") or [])
        for dep in deployments:
            all_tags.update(dep.get("tags") or [])
        return list(all_tags)

    def _parse_lineage_from_tags(self, tags: list[str]) -> tuple[list[str], list[str]]:
        """
        Extract source and destination table identifiers from Prefect flow tags.

        Supports two tag formats:
        1. Prefixed format (recommended): 'om-source:database.schema.table' and 'om-destination:database.schema.table'
        2. Legacy format: 'source:database.schema.table' and 'destination:database.schema.table'

        The prefixed format (om-*) is recommended to avoid conflicts with other tagging conventions.
        Only the prefix is matched case-insensitively; the database/schema/table segments keep
        their original case, since table lookups in OpenMetadata are case-sensitive.

        Returns (source_identifiers, destination_identifiers)
        """
        prefixes = (
            ("om-source:", "source"),
            ("om-destination:", "destination"),
            ("source:", "source"),
            ("destination:", "destination"),
        )

        sources = []
        destinations = []

        for tag in tags or []:
            stripped = tag.strip()
            lowered = stripped.lower()
            for prefix, kind in prefixes:
                if lowered.startswith(prefix):
                    identifier = stripped[len(prefix) :]
                    if identifier:
                        (sources if kind == "source" else destinations).append(identifier)
                    break

        # Remove duplicates while preserving order
        sources = list(dict.fromkeys(sources))
        destinations = list(dict.fromkeys(destinations))

        return sources, destinations

    def _resolve_table_fqn(self, identifier: str) -> str | None:
        """
        Resolve a lineage tag's <database>.<schema>.<table> identifier to the
        table's real OpenMetadata FQN by searching the configured lineage
        database services (``sourceConfig.lineageInformation.dbServiceNames``).
        """
        parts = identifier.split(".")
        if len(parts) != 3:
            logger.warning(f"Lineage tag must be <database>.<schema>.<table>, got: {identifier}")
            return None
        database, schema, table = parts
        try:
            return self._get_table_fqn_from_om(TableDetails(name=table, schema=schema, database=database))
        except FQNNotFoundException as exc:
            logger.debug(str(exc))
            return None

    def _build_task_status(self, task_runs: list[dict]) -> list[TaskStatus]:
        # ponytail: temporary, same experiment as _build_task_dag — real task
        # runs per flow run, not deployment names. Uses the same stable
        # per-run naming as _build_task_dag so status entries reference names
        # that actually exist on the pipeline's task list.
        id_to_name = _stable_task_names(task_runs)
        return [
            TaskStatus(
                name=id_to_name[run["id"]],
                executionStatus=PREFECT_STATE_MAP.get((run.get("state_type") or "UNKNOWN").upper(), StatusType.Pending),
                startTime=_parse_timestamp(run.get("start_time") or run.get("expected_start_time")),
                endTime=_parse_timestamp(run.get("end_time")),
            )
            for run in task_runs
        ]

    def _build_pipeline_status(self, flow_runs: list[dict]) -> list[PipelineStatus]:
        """
        Convert Prefect flow runs to OpenMetadata PipelineStatus, with each
        run's real task runs nested as ``taskStatus``. Always a list, never
        ``None`` — the server iterates ``taskStatus`` without a null guard, so
        a `null` here 500s even though the schema marks the field optional.
        """
        statuses = []
        for run in flow_runs:
            # In Prefect 3.x, use state_type (top-level) or state.type (nested)
            state_type = run.get("state_type") or (run.get("state") or {}).get("type", "UNKNOWN")
            state_type = state_type.upper()
            om_status = PREFECT_STATE_MAP.get(state_type, StatusType.Pending)

            start_time = _parse_timestamp(run.get("start_time") or run.get("expected_start_time"))
            end_time = _parse_timestamp(run.get("end_time"))

            task_runs = self.client.get_task_runs(run["id"])
            pipeline_status = PipelineStatus(
                executionStatus=om_status,
                taskStatus=self._build_task_status(task_runs),
                timestamp=start_time,
                endTime=end_time,
            )
            statuses.append(pipeline_status)
        return statuses

    def yield_tag(self, pipeline_details: dict) -> Iterable[Either[OMetaTagAndClassification]]:
        """Create the classification and tags for this flow's and its deployments' tags."""
        deployments = self.client.get_deployments(pipeline_details["id"])
        all_tags = self._get_all_tags(pipeline_details, deployments)
        yield from get_ometa_tag_and_classification(
            tags=all_tags,
            classification_name=PREFECT_TAG_CATEGORY,
            tag_description="Prefect Tag",
            classification_description="Tags associated with Prefect flows and deployments",
            include_tags=self.source_config.includeTags,
        )

    def yield_pipeline(self, flow: dict) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Convert a Prefect flow into an OpenMetadata CreatePipelineRequest.
        """
        try:
            flow_id = flow["id"]
            flow_name = flow["name"]
            logger.info(f"Processing flow: {flow_name}")

            # Get deployments to collect all tags
            deployments = self.client.get_deployments(flow_id)
            logger.debug(f"Found {len(deployments)} deployments for {flow_name}")

            # Collect tags from both flow and deployments
            all_tags = self._get_all_tags(flow, deployments)
            logger.debug(f"Tags for {flow_name}: {all_tags}")

            tag_labels = get_tag_labels(
                metadata=self.metadata,
                tags=all_tags,
                classification_name=PREFECT_TAG_CATEGORY,
                include_tags=self.source_config.includeTags,
            )

            # Build schedule description from first deployment if available
            description = None
            if deployments:
                dep = deployments[0]
                schedule = dep.get("schedule")
                if schedule:
                    description = f"Schedule: {schedule}"

            # ponytail: deployment-as-task disabled temporarily to test real
            # task-run ingestion instead. Restore this (and merge with task
            # runs, see _build_task_dag) once task-run ingestion is confirmed.
            # tasks = [
            #     Task(
            #         name=dep.get("name", dep["id"]),
            #         displayName=dep.get("name"),
            #         description=f"Deployment ID: {dep['id']}",
            #     )
            #     for dep in deployments
            # ]
            latest_run = self.client.get_flow_runs(flow_id, limit=1)
            task_runs = self.client.get_task_runs(latest_run[0]["id"]) if latest_run else []
            tasks = self._build_task_dag(task_runs)

            # Build sourceUrl dynamically based on mode
            account_id = self.service_connection.accountId
            workspace_id = self.service_connection.workspaceId
            if account_id and workspace_id:
                # Prefect Cloud mode
                source_url = (
                    f"https://app.prefect.cloud/account/{account_id}/workspace/{workspace_id}/flows/flow/{flow_id}"
                )
            else:
                # Self-hosted Prefect Server mode
                source_url = f"{self.service_connection.hostPort}/flows/flow/{flow_id}"

            # Get the service FQN from context
            service_fqn = self.context.get().pipeline_service

            create_request = CreatePipelineRequest(
                name=flow_name,
                displayName=flow_name,
                description=description,
                sourceUrl=SourceUrl(source_url),
                tasks=tasks or None,
                tags=tag_labels if tag_labels else None,
                service=FullyQualifiedEntityName(service_fqn),
            )

            logger.info(f"Yielding pipeline request for {flow_name}")
            yield Either(right=create_request)
            self.register_record(pipeline_request=create_request)

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=flow.get("name", "Prefect Pipeline"),
                    error=f"Failed to yield pipeline for flow {flow.get('name')}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_status(self, pipeline_details: dict) -> Iterable[Either[OMetaPipelineStatus]]:
        """Yield run history for each flow as pipeline status, each with that run's real task statuses nested."""
        try:
            flow_id = pipeline_details["id"]
            flow_runs = self.client.get_flow_runs(flow_id, limit=self.service_connection.numberOfStatus)
            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,
                pipeline_name=self.context.get().pipeline,
            )
            for status in self._build_pipeline_status(flow_runs):
                yield Either(right=OMetaPipelineStatus(pipeline_fqn=pipeline_fqn, pipeline_status=status))
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.get("name", "Prefect Pipeline Status"),
                    error=f"Failed to yield status for flow {pipeline_details.get('name')}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_lineage_details(self, pipeline_details: dict) -> Iterable[Either[AddLineageRequest]]:
        """
        Yield table-to-table lineage edges for tables named in this flow's and
        its deployments' lineage tags, attributing the edge to this pipeline via
        ``LineageDetails``. Lineage is detected from tags:
        'om-source:<database>.<schema>.<table>' and 'om-destination:<database>.<schema>.<table>'
        (legacy 'source:'/'destination:' prefixes are also accepted). Every
        detected source is linked to every detected destination, since tags
        carry no per-pair mapping. Requires ``sourceConfig.lineageInformation
        .dbServiceNames`` to be configured with the database service(s) the
        tagged tables live in.
        """
        try:
            # Get deployments to collect all tags
            flow_id = pipeline_details["id"]
            deployments = self.client.get_deployments(flow_id)

            # Collect all tags from flow and deployments
            all_tags = self._get_all_tags(pipeline_details, deployments)

            # Parse lineage from tags
            sources, destinations = self._parse_lineage_from_tags(all_tags)

            if not sources or not destinations:
                # A table-to-table edge needs both ends; nothing to draw otherwise
                logger.debug(f"No source/destination lineage tag pair for flow {pipeline_details['name']}")
                return

            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,
                pipeline_name=self.context.get().pipeline,
            )
            pipeline_entity = self.metadata.get_by_name(entity=Pipeline, fqn=pipeline_fqn)
            if not pipeline_entity:
                logger.warning(f"Pipeline entity not found for {pipeline_fqn}")
                return

            lineage_details = LineageDetails(
                pipeline=EntityReference(id=pipeline_entity.id.root, type="pipeline"),
                source=LineageSource.PipelineLineage,
            )

            for source_identifier in sources:
                source_table_fqn = self._resolve_table_fqn(source_identifier)
                source_table = source_table_fqn and self.metadata.get_by_name(entity=Table, fqn=source_table_fqn)
                if not source_table:
                    logger.debug(f"Source table not found in OpenMetadata: {source_identifier}")
                    continue

                for dest_identifier in destinations:
                    dest_table_fqn = self._resolve_table_fqn(dest_identifier)
                    dest_table = dest_table_fqn and self.metadata.get_by_name(entity=Table, fqn=dest_table_fqn)
                    if not dest_table:
                        logger.debug(f"Destination table not found in OpenMetadata: {dest_identifier}")
                        continue

                    logger.info(f"Creating lineage: {source_table_fqn} -> {dest_table_fqn}")
                    yield Either(
                        right=AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(id=source_table.id, type="table"),
                                toEntity=EntityReference(id=dest_table.id, type="table"),
                                lineageDetails=lineage_details,
                            )
                        )
                    )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.get("name", "Prefect Pipeline Lineage"),
                    error=f"Failed to yield lineage for flow {pipeline_details.get('name')}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_pipelines_list(self) -> Iterable[dict]:
        """Get List of all Prefect flows."""
        yield from self.client.get_flows()

    def get_pipeline_name(self, pipeline_details: dict) -> str:
        """Return the flow name to use as pipeline name."""
        return pipeline_details["name"]
