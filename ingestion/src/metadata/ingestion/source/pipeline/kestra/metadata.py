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
Kestra source module — ingests Kestra flows, executions, and lineage
into OpenMetadata.
"""

import traceback
from collections import deque
from collections.abc import Iterable, Iterator

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
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
from metadata.ingestion.source.pipeline.kestra.models import (
    KestraExecution,
    KestraFlow,
    KestraGraph,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils.filters import filter_by_pipeline
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


# Kestra State -> OM StatusType
STATE_MAP = {
    "SUCCESS": StatusType.Successful,
    "WARNING": StatusType.Successful,
    "FAILED": StatusType.Failed,
    "KILLED": StatusType.Failed,
    "CANCELLED": StatusType.Failed,
    "RETRIED": StatusType.Skipped,
}


def _map_state(state_current: str | None) -> StatusType:
    if not state_current:
        return StatusType.Pending
    return STATE_MAP.get(state_current.upper(), StatusType.Pending)


def _flow_fqn(flow: KestraFlow) -> str:
    return f"{flow.namespace}.{flow.id}"


def _ms(dt) -> int | None:
    if dt is None:
        return None
    return int(dt.timestamp() * 1000)


class KestraSource(PipelineServiceSource):
    """Ingest Kestra flow + execution metadata into OpenMetadata."""

    config: WorkflowSource

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ) -> "KestraSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: KestraConnection = config.serviceConnection.root.config  # pyright: ignore[reportOptionalMemberAccess]
        if not isinstance(connection, KestraConnection):
            raise InvalidSourceException(f"Expected KestraConnection, got {type(connection).__name__}")
        return cls(config, metadata)

    def close(self):
        if getattr(self, "client", None) is not None:
            self.client.close()
        super().close()

    # ---------- required: list pipeline_details ----------

    def get_pipelines_list(self) -> Iterable[KestraFlow]:  # pyright: ignore[reportIncompatibleMethodOverride]
        try:
            for flow in self.client.search_flows():
                if flow.disabled:
                    logger.debug("Skipping disabled flow %s", _flow_fqn(flow))
                    continue
                if filter_by_pipeline(self.source_config.pipelineFilterPattern, _flow_fqn(flow)):
                    self.status.filter(_flow_fqn(flow), "Filtered out")
                    continue
                yield flow
        except Exception as exc:
            logger.warning("Kestra list flows failed: %s", exc)
            logger.debug(traceback.format_exc())

    def get_pipeline_name(self, pipeline_details: KestraFlow) -> str:
        return _flow_fqn(pipeline_details)

    # ---------- required: emit Pipeline + Status + Lineage ----------

    def yield_pipeline(self, pipeline_details: KestraFlow) -> Iterator[Either[CreatePipelineRequest]]:
        try:
            graph = self.client.get_flow_graph(pipeline_details.namespace, pipeline_details.id)
            tasks = self._tasks_from_graph(graph)
            service_name = self.context.get().pipeline_service
            host_port = str(self.service_connection.hostPort).rstrip("/")
            source_url = f"{host_port}/ui/flows/edit/{pipeline_details.namespace}/{pipeline_details.id}"

            request = CreatePipelineRequest(
                name=EntityName(_flow_fqn(pipeline_details)),
                displayName=pipeline_details.id,
                description=(Markdown(pipeline_details.description) if pipeline_details.description else None),
                sourceUrl=SourceUrl(source_url),
                tasks=tasks,
                scheduleInterval=self._schedule_from_triggers(pipeline_details.triggers),
                service=service_name,
            )
            yield Either(right=request)
        except Exception as exc:
            yield Either(left=self._error(f"Error ingesting Kestra flow {_flow_fqn(pipeline_details)}", exc))

    def yield_pipeline_status(self, pipeline_details: KestraFlow) -> Iterator[Either[OMetaPipelineStatus]]:
        try:
            summaries = list(
                self.client.search_executions(
                    namespace=pipeline_details.namespace,
                    flow_id=pipeline_details.id,
                    page_size=50,
                    max_pages=1,
                )
            )
        except Exception as exc:
            yield Either(left=self._error(f"List executions failed for {_flow_fqn(pipeline_details)}", exc))
            return

        pipeline_fqn = self._pipeline_fqn(pipeline_details)
        for summary in summaries:
            try:
                ts = _ms(summary.state.startDate or summary.state.endDate)
                pipeline_status = PipelineStatus(
                    timestamp=Timestamp(ts) if ts else None,
                    executionStatus=_map_state(summary.state.current),
                    taskStatus=self._task_statuses(summary),
                )
                yield Either(right=OMetaPipelineStatus(pipeline_fqn=pipeline_fqn, pipeline_status=pipeline_status))
            except Exception as exc:
                yield Either(left=self._error(f"Status for execution {summary.id} failed", exc))

    def yield_pipeline_lineage_details(self, pipeline_details: KestraFlow) -> Iterator[Either[AddLineageRequest]]:
        triggers = pipeline_details.triggers or []
        if not triggers:
            return

        this_fqn = self._pipeline_fqn(pipeline_details)
        this_pipe = self.metadata.get_by_name(entity=Pipeline, fqn=this_fqn)
        if not this_pipe:
            return

        service_name = self.context.get().pipeline_service
        for trig in triggers:
            if not trig.type.endswith("trigger.Flow"):
                continue
            for cond in trig.conditions or []:
                ctype = str(cond.get("type", ""))
                if not ctype.endswith("ExecutionFlowCondition"):
                    continue
                up_ns = cond.get("namespace")
                up_id = cond.get("flowId")
                if not (up_ns and up_id):
                    continue
                up_fqn = f'{service_name}."{up_ns}.{up_id}"'
                up_pipe = self.metadata.get_by_name(entity=Pipeline, fqn=up_fqn)
                if not up_pipe:
                    continue
                try:
                    yield Either(
                        right=AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(
                                    id=up_pipe.id,
                                    type="pipeline",
                                ),
                                toEntity=EntityReference(
                                    id=this_pipe.id,
                                    type="pipeline",
                                ),
                                lineageDetails=LineageDetails(
                                    source=LineageSource.PipelineLineage,
                                    description=f"Kestra Flow trigger: {trig.id}",
                                ),
                            )
                        )
                    )
                except Exception as exc:
                    yield Either(left=self._error(f"Lineage edge {up_fqn} -> {this_fqn} failed", exc))

    # ---------- helpers ----------

    @staticmethod
    def _tasks_from_graph(graph: KestraGraph) -> list[Task]:
        """
        Convert a Kestra /graph response (nodes + edges, including synthetic
        cluster wrapper nodes) to a flat list of OM `Task` entities with
        downstream task ids.

        Kestra emits synthetic `GraphClusterRoot` / `GraphClusterEnd` /
        `GraphTrigger` nodes (no `task.id`) around real tasks. We skip them and
        compute transitive closure across them so a real task's downstream set
        contains real-task ids only.
        """
        adj: dict[str, list[str]] = {}
        for edge in graph.edges:
            adj.setdefault(edge.source, []).append(edge.target)

        # uid -> task id for real tasks (synthetic nodes excluded).
        uid_to_taskid: dict[str, str] = {}
        for n in graph.nodes:
            if n.task and n.task.id:
                uid_to_taskid[n.uid] = n.task.id

        def downstream_tasks(start_uid: str) -> list[str]:
            """BFS through synthetic nodes; stop at each real task encountered."""
            seen: set[str] = set()
            out: list[str] = []
            queue: deque[str] = deque(adj.get(start_uid, []))
            while queue:
                uid = queue.popleft()
                if uid in seen:
                    continue
                seen.add(uid)
                tid = uid_to_taskid.get(uid)
                if tid:
                    if tid != uid_to_taskid.get(start_uid) and tid not in out:
                        out.append(tid)
                    # don't traverse past a real task
                    continue
                queue.extend(adj.get(uid, []))
            return out

        tasks: list[Task] = []
        emitted: set[str] = set()
        for node in graph.nodes:
            task_id = uid_to_taskid.get(node.uid)
            if not task_id or task_id in emitted:
                continue
            emitted.add(task_id)
            tasks.append(
                Task(
                    name=task_id,
                    displayName=task_id,
                    taskType=node.task.type if node.task else None,
                    downstreamTasks=downstream_tasks(node.uid) or None,
                )
            )
        return tasks

    @staticmethod
    def _schedule_from_triggers(triggers: list | None) -> str | None:
        if not triggers:
            return None
        for trig in triggers:
            if trig.type.endswith("Schedule") and trig.cron:
                return str(trig.cron)
        return None

    def _task_statuses(self, detail: KestraExecution) -> list[TaskStatus]:
        rows: list[TaskStatus] = []
        for tr in detail.taskRunList or []:
            ts = _ms(tr.state.startDate or tr.timestamp)
            rows.append(
                TaskStatus(
                    name=tr.taskId,
                    executionStatus=_map_state(tr.state.current),
                    startTime=Timestamp(ts) if ts else None,
                )
            )
        return rows

    def _pipeline_fqn(self, flow: KestraFlow) -> str:
        service_name = self.context.get().pipeline_service
        # The Pipeline name contains dots (Kestra namespace), so OM wraps it
        # in quotes when forming the FQN. Mirror that here so get_by_name()
        # resolves during lineage and status emission.
        return f'{service_name}."{_flow_fqn(flow)}"'

    def _error(self, msg: str, exc: Exception) -> StackTraceError:
        logger.warning("%s: %s", msg, exc)
        logger.debug(traceback.format_exc())
        return StackTraceError(name=msg, error=str(exc), stackTrace=traceback.format_exc())
