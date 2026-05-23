"""
Prefect connector for OpenMetadata.
Ingests flows, deployments, run history, and lineage from Prefect Cloud.
"""
from __future__ import annotations

import traceback
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
from metadata.generated.schema.entity.services.connections.pipeline.prefectConnection import (
    PrefectConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, SourceUrl
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.ingestion.source.pipeline.prefect.connection import _build_base_url
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Map Prefect run states to OpenMetadata status types
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


class PrefectSource(PipelineServiceSource):
    """
    Prefect connector — ingests pipeline metadata from Prefect Cloud.
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        self.service_connection: PrefectConnection = (
            config.serviceConnection.root.config
        )

        # Validate accountId/workspaceId consistency
        has_account = bool(self.service_connection.accountId)
        has_workspace = bool(self.service_connection.workspaceId)
        if has_account != has_workspace:
            raise InvalidSourceException(
                "Both accountId and workspaceId must be provided for "
                "Prefect Cloud, or both must be empty for self-hosted mode."
            )

        # Use shared base URL builder
        self.base_url = _build_base_url(self.service_connection)

        # Handle both SecretStr and plain string for apiKey
        api_key = self.service_connection.apiKey
        if hasattr(api_key, "get_secret_value"):
            api_key_str = api_key.get_secret_value()
        else:
            api_key_str = str(api_key)

        self.headers = {
            "Authorization": f"Bearer {api_key_str}",
            "Content-Type": "application/json",
            "User-Agent": "OpenMetadata/Prefect-Connector",
        }

        # Now call parent __init__ which will call test_connection()
        super().__init__(config, metadata)
        self.source_config = self.config.sourceConfig.config

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ) -> "PrefectSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: PrefectConnection = config.serviceConnection.root.config
        if not isinstance(connection, PrefectConnection):
            raise InvalidSourceException(
                f"Expected PrefectConnection, got {connection}"
            )
        return cls(config, metadata)

    def _get_flows(self) -> Iterable[dict]:
        """
        Fetch flows from Prefect using pagination with generator pattern.
        Yields flows one at a time to avoid loading all flows into memory.
        """
        offset = 0
        limit = 200  # Prefect API maximum per request

        try:
            while True:
                response = self.connection.post(
                    f"{self.base_url}/flows/filter",
                    headers=self.headers,
                    json={"limit": limit, "offset": offset},
                )
                response.raise_for_status()
                flows = response.json()

                if not flows:
                    break

                # Yield each flow individually instead of accumulating
                yield from flows

                # If we got fewer than limit, we've reached the end
                if len(flows) < limit:
                    break

                offset += limit

        except Exception as exc:
            logger.error(f"Failed to fetch flows: {exc}")
            logger.debug(traceback.format_exc())

    def _get_flow_runs(self, flow_id: str) -> List[dict]:
        """Fetch recent run history for a specific flow."""
        try:
            limit = getattr(self.service_connection, "numberOfStatus", 10)
            response = self.connection.post(
                f"{self.base_url}/flow_runs/filter",
                headers=self.headers,
                json={
                    "flow_filter": {"id": {"any_": [flow_id]}},
                    "limit": limit,
                    "sort": "START_TIME_DESC",
                },
            )
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            logger.warning(f"Failed to fetch runs for flow {flow_id}: {exc}")
            return []

    def _get_deployments(self, flow_id: str) -> List[dict]:
        """Fetch deployments for a specific flow."""
        try:
            response = self.connection.post(
                f"{self.base_url}/deployments/filter",
                headers=self.headers,
                json={
                    "deployments": {"flow_id": {"any_": [flow_id]}},
                    "limit": 50,
                    "offset": 0,
                },
            )
            response.raise_for_status()
            all_deps = response.json()

            # Belt-and-suspenders: filter client-side too in case API filter doesn't work
            filtered = [d for d in all_deps if d.get("flow_id") == flow_id]

            if len(filtered) != len(all_deps):
                logger.debug(
                    f"API returned {len(all_deps)} deployments, "
                    f"filtered to {len(filtered)} for flow {flow_id}"
                )

            return filtered
        except Exception as exc:
            logger.warning(f"Failed to fetch deployments for flow {flow_id}: {exc}")
            return []

    def _get_all_tags(self, flow: dict, deployments: List[dict]) -> List[str]:
        """
        Collect all unique tags from flow and its deployments.
        In Prefect 3.x, tags can be on flows or deployments.
        """
        all_tags = set(flow.get("tags") or [])
        for dep in deployments:
            all_tags.update(dep.get("tags") or [])
        return list(all_tags)

    def _parse_lineage_from_tags(self, tags: List[str]) -> tuple[List[str], List[str]]:
        """
        Extract source and destination table FQNs from Prefect flow tags.

        Supports two tag formats:
        1. Prefixed format (recommended): 'om-source:db.schema.table' and 'om-destination:db.schema.table'
        2. Legacy format: 'source:db.schema.table' and 'destination:db.schema.table'

        The prefixed format (om-*) is recommended to avoid conflicts with other tagging conventions.

        Returns (source_fqns, destination_fqns)
        """
        sources = []
        destinations = []

        for tag in tags or []:
            tag = tag.strip().lower()  # Normalize to lowercase for consistency

            # Check for prefixed format first (recommended)
            if tag.startswith("om-source:"):
                fqn = tag[len("om-source:") :]
                if fqn:  # Ensure FQN is not empty
                    sources.append(fqn)
            elif tag.startswith("om-destination:"):
                fqn = tag[len("om-destination:") :]
                if fqn:
                    destinations.append(fqn)
            # Fall back to legacy format for backward compatibility
            elif tag.startswith("source:"):
                fqn = tag[len("source:") :]
                if fqn:
                    sources.append(fqn)
            elif tag.startswith("destination:"):
                fqn = tag[len("destination:") :]
                if fqn:
                    destinations.append(fqn)

        # Remove duplicates while preserving order
        sources = list(dict.fromkeys(sources))
        destinations = list(dict.fromkeys(destinations))

        return sources, destinations

    def _build_pipeline_status(self, flow_runs: List[dict]) -> List[PipelineStatus]:
        """Convert Prefect flow runs to OpenMetadata PipelineStatus."""
        from datetime import datetime

        def parse_timestamp(ts_str: str) -> Optional[int]:
            """Convert ISO timestamp string to Unix timestamp (milliseconds)."""
            if not ts_str:
                return None
            try:
                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                return int(dt.timestamp() * 1000)  # Convert to milliseconds
            except Exception:
                return None

        statuses = []
        for run in flow_runs:
            # In Prefect 3.x, use state_type (top-level) or state.type (nested)
            state_type = run.get("state_type") or (run.get("state") or {}).get(
                "type", "UNKNOWN"
            )
            state_type = state_type.upper()
            om_status = PREFECT_STATE_MAP.get(state_type, StatusType.Failed)

            # Convert timestamps to Unix timestamps (milliseconds)
            start_time_str = run.get("start_time") or run.get("expected_start_time")
            end_time_str = run.get("end_time")

            start_time = parse_timestamp(start_time_str)
            end_time = parse_timestamp(end_time_str)

            # TaskStatus requires a name field
            task_status = TaskStatus(
                name=run.get("name", run.get("id", "unknown")),
                executionStatus=om_status,
                startTime=start_time,
                endTime=end_time,
            )

            pipeline_status = PipelineStatus(
                executionStatus=om_status,
                taskStatus=[task_status],
                timestamp=start_time,
            )
            statuses.append(pipeline_status)
        return statuses

    def yield_pipeline(self, flow: dict) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Convert a Prefect flow into an OpenMetadata CreatePipelineRequest.
        """
        try:
            flow_id = flow["id"]
            flow_name = flow["name"]
            logger.info(f"Processing flow: {flow_name}")

            # Get deployments to collect all tags
            deployments = self._get_deployments(flow_id)
            logger.debug(f"Found {len(deployments)} deployments for {flow_name}")

            # Collect tags from both flow and deployments
            all_tags = self._get_all_tags(flow, deployments)
            logger.debug(f"Tags for {flow_name}: {all_tags}")

            # Convert string tags to TagLabel objects
            tag_labels = []
            for tag in all_tags:
                tag_labels.append(
                    TagLabel(
                        tagFQN=tag,
                        source=TagSource.Classification,
                        labelType=LabelType.Automated,
                        state=State.Suggested,
                    )
                )

            # Build schedule description from first deployment if available
            description = None
            if deployments:
                dep = deployments[0]
                schedule = dep.get("schedule")
                if schedule:
                    description = f"Schedule: {schedule}"

            # Build tasks from deployments (each deployment = a runnable task)
            tasks = []
            for dep in deployments:
                tasks.append(
                    Task(
                        name=dep.get("name", dep["id"]),
                        displayName=dep.get("name"),
                        description=f"Deployment ID: {dep['id']}",
                    )
                )

            # Build sourceUrl dynamically based on mode
            if (
                self.service_connection.accountId
                and self.service_connection.workspaceId
            ):
                # Prefect Cloud mode
                source_url = f"https://app.prefect.cloud/flow-runs?flow_id={flow_id}"
            else:
                # Self-hosted Prefect Server mode
                host = (
                    getattr(self.service_connection, "hostPort", None)
                    or "http://localhost:4200"
                )
                source_url = f"{host}/flow-runs?flow_id={flow_id}"

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

        except Exception as exc:
            logger.error(f"Failed to yield pipeline for flow {flow.get('name')}: {exc}")
            logger.debug(traceback.format_exc())
            yield Either(left=exc)

    def yield_pipeline_status(
        self, pipeline_details: dict
    ) -> Iterable[Either[PipelineStatus]]:
        """Yield run history for each flow as pipeline status."""
        try:
            flow_id = pipeline_details["id"]
            flow_runs = self._get_flow_runs(flow_id)
            for status in self._build_pipeline_status(flow_runs):
                yield Either(right=status)
        except Exception as exc:
            logger.warning(f"Failed to yield status: {exc}")
            yield Either(left=exc)

    def yield_pipeline_lineage_details(
        self, pipeline_details: dict
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Yield lineage edges between source tables and this pipeline,
        and between this pipeline and destination tables.
        Lineage is detected from tags: 'source:fqn' and 'destination:fqn'
        """
        try:
            # Get deployments to collect all tags
            flow_id = pipeline_details["id"]
            deployments = self._get_deployments(flow_id)

            # Collect all tags from flow and deployments
            all_tags = self._get_all_tags(pipeline_details, deployments)

            # Parse lineage from tags
            sources, destinations = self._parse_lineage_from_tags(all_tags)

            if not sources and not destinations:
                # No lineage tags found, skip silently (this is normal)
                logger.debug(
                    f"No lineage tags found for flow {pipeline_details['name']}"
                )
                return

            flow_name = pipeline_details["name"]

            # Get the service FQN from context
            service_fqn = self.context.get().pipeline_service
            pipeline_fqn = f"{service_fqn}.{flow_name}"

            pipeline_entity = self.metadata.get_by_name(
                entity=Pipeline, fqn=pipeline_fqn
            )
            if not pipeline_entity:
                logger.warning(f"Pipeline entity not found for {pipeline_fqn}")
                return

            # Create lineage edges for source tables
            for source_fqn in sources:
                from metadata.generated.schema.entity.data.table import Table

                source_table = self.metadata.get_by_name(entity=Table, fqn=source_fqn)
                if source_table:
                    logger.info(f"Creating lineage: {source_fqn} -> {flow_name}")
                    yield Either(
                        right=AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(
                                    id=source_table.id, type="table"
                                ),
                                toEntity=EntityReference(
                                    id=pipeline_entity.id, type="pipeline"
                                ),
                            )
                        )
                    )
                else:
                    logger.debug(
                        f"Source table not found in OpenMetadata: {source_fqn}"
                    )

            # Create lineage edges for destination tables
            for dest_fqn in destinations:
                from metadata.generated.schema.entity.data.table import Table

                dest_table = self.metadata.get_by_name(entity=Table, fqn=dest_fqn)
                if dest_table:
                    logger.info(f"Creating lineage: {flow_name} -> {dest_fqn}")
                    yield Either(
                        right=AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(
                                    id=pipeline_entity.id, type="pipeline"
                                ),
                                toEntity=EntityReference(
                                    id=dest_table.id, type="table"
                                ),
                            )
                        )
                    )
                else:
                    logger.debug(
                        f"Destination table not found in OpenMetadata: {dest_fqn}"
                    )

        except Exception as exc:
            logger.warning(f"Failed to yield lineage: {exc}")
            logger.debug(traceback.format_exc())

    def get_pipelines_list(self) -> Iterable[dict]:
        """Producer: returns list of all Prefect flows."""
        logger.info("Fetching flows from Prefect Cloud...")
        count = 0
        for flow in self._get_flows():
            logger.debug(f"Flow: {flow.get('name')} (ID: {flow.get('id')})")
            count += 1
            yield flow
        logger.info(f"Found {count} flows")

    def get_pipeline_name(self, pipeline_details: dict) -> str:
        """Return the flow name to use as pipeline name."""
        return pipeline_details["name"]

    def close(self):
        """Close the HTTP client connection."""
        if hasattr(self, "connection") and self.connection:
            self.connection.close()

    def test_connection(self) -> None:
        """
        Test connection to Prefect Cloud API.
        Validates API key, account ID, and workspace ID by attempting to fetch flows.
        """
        from metadata.ingestion.source.pipeline.prefect.connection import (
            test_connection,
        )

        test_connection(
            self.metadata,
            self.connection,
            self.service_connection,
            self.base_url,
            self.headers,
        )
