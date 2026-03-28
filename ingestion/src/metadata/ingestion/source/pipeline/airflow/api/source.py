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
Airflow REST API source to extract metadata via Airflow REST API
"""
import traceback
from typing import Iterable, List, Optional
from urllib.parse import quote

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineState,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import (
    AirflowConnection,
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
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.airflow.api.models import AirflowApiDagDetails
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.helpers import clean_uri, datetime_to_ts
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

logger = ingestion_logger()

AIRFLOW_TAG_CATEGORY = "AirflowTags"

STATUS_MAP = {
    "success": StatusType.Successful.value,
    "failed": StatusType.Failed.value,
    "queued": StatusType.Pending.value,
    "skipped": StatusType.Skipped.value,
    "running": StatusType.Pending.value,
    "upstream_failed": StatusType.Failed.value,
}


class AirflowApiSource(PipelineServiceSource):
    """
    Implements the necessary methods to extract
    Pipeline metadata from Airflow's REST API
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ) -> "AirflowApiSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: AirflowConnection = config.serviceConnection.root.config
        if not isinstance(connection, AirflowConnection):
            raise InvalidSourceException(
                f"Expected AirflowConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_pipelines_list(self) -> Iterable[AirflowApiDagDetails]:
        all_dags = self.connection.get_all_dags()
        for dag_data in all_dags:
            try:
                yield self.connection.build_dag_details(dag_data)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error building DAG details for {dag_data.get('dag_id')}: {exc}"
                )

    def get_pipeline_name(self, pipeline_details: AirflowApiDagDetails) -> str:
        return pipeline_details.dag_id

    def get_pipeline_state(
        self, pipeline_details: AirflowApiDagDetails
    ) -> Optional[PipelineState]:
        if pipeline_details.is_paused is None:
            return None
        return (
            PipelineState.Inactive
            if pipeline_details.is_paused
            else PipelineState.Active
        )

    def _get_task_source_url(self, dag_id: str, task_id: str) -> str:
        host = clean_uri(self.service_connection.hostPort)
        if self.connection.api_version == "v2":
            return f"{host}/dags/{quote(dag_id)}/tasks/{quote(task_id)}"
        return (
            f"{host}/taskinstance/list/"
            f"?_flt_3_dag_id={quote(dag_id)}&_flt_3_task_id={quote(task_id)}"
        )

    def _get_dag_source_url(self, dag_id: str) -> str:
        host = clean_uri(self.service_connection.hostPort)
        if self.connection.api_version == "v2":
            return f"{host}/dags/{quote(dag_id)}"
        return f"{host}/dags/{quote(dag_id)}/grid"

    def _build_tasks(self, dag_details: AirflowApiDagDetails) -> List[Task]:
        return [
            Task(
                name=task.task_id,
                description=Markdown(task.doc_md) if task.doc_md else None,
                sourceUrl=SourceUrl(
                    self._get_task_source_url(dag_details.dag_id, task.task_id)
                ),
                downstreamTasks=task.downstream_task_ids or [],
                startDate=task.start_date,
                endDate=task.end_date,
                taskType=task.class_ref.get("class_name") if task.class_ref else None,
            )
            for task in dag_details.tasks
        ]

    def yield_pipeline(
        self, pipeline_details: AirflowApiDagDetails
    ) -> Iterable[Either[CreatePipelineRequest]]:
        try:
            pipeline_request = CreatePipelineRequest(
                name=EntityName(pipeline_details.dag_id),
                description=Markdown(pipeline_details.description)
                if pipeline_details.description
                else None,
                sourceUrl=SourceUrl(self._get_dag_source_url(pipeline_details.dag_id)),
                state=self.get_pipeline_state(pipeline_details),
                concurrency=pipeline_details.max_active_runs,
                pipelineLocation=pipeline_details.fileloc,
                startDate=pipeline_details.start_date.isoformat()
                if pipeline_details.start_date
                else None,
                tasks=self._build_tasks(pipeline_details),
                service=FullyQualifiedEntityName(self.context.get().pipeline_service),
                scheduleInterval=pipeline_details.schedule_interval,
                tags=get_tag_labels(
                    metadata=self.metadata,
                    tags=pipeline_details.tags or [],
                    classification_name=AIRFLOW_TAG_CATEGORY,
                    include_tags=self.source_config.includeTags,
                ),
            )
            yield Either(right=pipeline_request)
            self.register_record(pipeline_request=pipeline_request)
            self.context.get().task_names = {
                task.name for task in pipeline_request.tasks or []
            }
        except Exception as exc:
            self.context.get().task_names = set()
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.dag_id,
                    error=f"Error building pipeline from {pipeline_details.dag_id}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_status(
        self, pipeline_details: AirflowApiDagDetails
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        try:
            num_status = self.service_connection.numberOfStatus or 10
            dag_runs = self.connection.get_dag_runs(
                pipeline_details.dag_id, limit=num_status
            )

            for dag_run in dag_runs:
                if not dag_run.dag_run_id or not self.context.get().task_names:
                    continue

                task_instances = self.connection.get_task_instances_for_run(
                    pipeline_details.dag_id, dag_run.dag_run_id
                )

                task_statuses = [
                    TaskStatus(
                        name=ti.task_id,
                        executionStatus=STATUS_MAP.get(
                            ti.state, StatusType.Pending.value
                        ),
                        startTime=datetime_to_ts(ti.start_date),
                        endTime=datetime_to_ts(ti.end_date),
                    )
                    for ti in task_instances
                    if ti.task_id in self.context.get().task_names
                ]

                timestamp = datetime_to_ts(dag_run.execution_date)
                if timestamp is None:
                    timestamp = datetime_to_ts(dag_run.start_date)
                if timestamp is None:
                    timestamp = datetime_to_ts(dag_run.end_date)
                if timestamp is None:
                    logger.debug(
                        "Skipping DAG run %s for %s — no timestamp available",
                        dag_run.dag_run_id,
                        pipeline_details.dag_id,
                    )
                    continue

                pipeline_status = PipelineStatus(
                    executionId=dag_run.dag_run_id,
                    taskStatus=task_statuses,
                    executionStatus=STATUS_MAP.get(
                        dag_run.state, StatusType.Pending.value
                    ),
                    timestamp=Timestamp(timestamp),
                )
                pipeline_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Pipeline,
                    service_name=self.context.get().pipeline_service,
                    pipeline_name=self.context.get().pipeline,
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
                    name=f"{pipeline_details.dag_id} Pipeline Status",
                    error=f"Error extracting status for DAG {pipeline_details.dag_id}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_lineage_details(
        self, pipeline_details: AirflowApiDagDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        return []

    def yield_tag(
        self, pipeline_details: AirflowApiDagDetails
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        yield from get_ometa_tag_and_classification(
            tags=pipeline_details.tags or [],
            classification_name=AIRFLOW_TAG_CATEGORY,
            tag_description="Airflow Tag",
            classification_description="Tags associated with airflow entities.",
            include_tags=self.source_config.includeTags,
        )
