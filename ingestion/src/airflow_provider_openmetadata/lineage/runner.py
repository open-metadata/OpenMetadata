#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
OpenMetadata Airflow Provider Lineage Runner
"""
from itertools import groupby
from typing import List, Set

from airflow.configuration import conf
from pydantic import BaseModel

from airflow_provider_openmetadata.lineage.utils import STATUS_MAP, get_xlets
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceRequest,
)
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import (
    AirflowConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.backendConnection import (
    BackendConnection,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.helpers import datetime_to_ts


class XLets(BaseModel):
    """
    Group inlets and outlets from all tasks in a DAG
    """

    inlets: Set[str]
    outlets: Set[str]


class SimpleEdge(BaseModel):
    """
    Simple Edge representation with FQN and id
    """

    fqn: str
    id: str


class AirflowLineageRunner:
    """
    Given the OpenMetadata connection, a service name and a DAG:

    1. Create the Pipeline Service (if not exists)
    2. Create or update the Pipeline (DAG + tasks)
    3. Add the task status (Task Instances). We'll pick this up from the available information.
          This operator should run the last to have the complete view.
    4. Add Pipeline Lineage from xlets

    This Runner will be called either from:
    1. Lineage Backend
    2. Lineage Operator
    In both cases, this will run directly on an Airflow instance. Therefore,
    we'll use the airflow config data to populate entities' details.
    """

    def __init__(
        self,
        metadata: OpenMetadata,
        service_name: str,
        dag: "DAG",
        context: "Context",
        only_keep_dag_lineage: bool = False,
        max_status: int = 10,
    ):
        self.metadata = metadata
        self.service_name = service_name
        self.only_keep_dag_lineage = only_keep_dag_lineage
        self.max_status = max_status

        self.dag = dag
        self.context = context

    def get_or_create_pipeline_service(self) -> PipelineService:
        """
        Fetch the Pipeline Service from OM. If it does not exist,
        create it.
        """
        service_entity: PipelineService = self.metadata.get_by_name(
            entity=PipelineService, fqn=self.service_name
        )

        if service_entity:
            return service_entity

        else:
            pipeline_service: PipelineService = self.metadata.create_or_update(
                CreatePipelineServiceRequest(
                    name=self.service_name,
                    serviceType=PipelineServiceType.Airflow,
                    connection=PipelineConnection(
                        config=AirflowConnection(
                            hostPort=conf.get("webserver", "base_url"),
                            connection=BackendConnection(),
                        ),
                    ),
                )
            )

            if pipeline_service is None:
                raise RuntimeError("Failed to create Airflow service.")

            return pipeline_service

    def get_task_url(self, task: "Operator"):
        return f"/taskinstance/list/?flt1_dag_id_equals={self.dag.dag_id}&_flt_3_task_id={task.task_id}"

    def get_om_tasks(self) -> List[Task]:
        """
        Get all tasks from the DAG and map them to
        OpenMetadata Task Entities
        """
        return [
            Task(
                name=task.task_id,
                taskUrl=self.get_task_url(task),
                taskType=task.task_type,
                startDate=task.start_date.isoformat() if task.start_date else None,
                endDate=task.end_date.isoformat() if task.end_date else None,
                downstreamTasks=list(task.downstream_task_ids)
                if task.downstream_task_ids
                else None,
            )
            for task in self.dag.tasks or []
        ]

    def create_pipeline_entity(self, pipeline_service: PipelineService) -> Pipeline:
        """
        Create the Pipeline Entity
        """
        self.dag.log.info("Creating or updating Pipeline Entity from DAG...")
        pipeline_request = CreatePipelineRequest(
            name=self.dag.dag_id,
            description=self.dag.description,
            pipelineUrl=f"/tree?dag_id={self.dag.dag_id}",
            concurrency=self.dag.max_active_tasks,
            pipelineLocation=self.dag.fileloc,
            startDate=self.dag.start_date.isoformat() if self.dag.start_date else None,
            tasks=self.get_om_tasks(),
            service=EntityReference(
                id=pipeline_service.id,
                type="pipelineService",
            ),
        )

        return self.metadata.create_or_update(pipeline_request)

    def get_all_pipeline_status(self) -> List[PipelineStatus]:
        """
        Iterate over the DAG's task instances and map
        them to PipelineStatus
        """

        # This list is already ordered by Execution Date
        grouped_ti: List[List["TaskInstance"]] = [
            list(value)
            for _, value in groupby(
                self.dag.get_task_instances(), key=lambda ti: ti.run_id
            )
        ]
        # Order descending by execution date
        grouped_ti.reverse()

        return [
            self.get_pipeline_status(task_instances)
            for task_instances in grouped_ti[: self.max_status]
        ]

    @staticmethod
    def get_dag_status_from_task_instances(task_instances: List["TaskInstance"]) -> str:
        """
        If any task is in pending state, then return pending.
        If any task is in failed state, return failed.
        Otherwise, return Success.
        """
        task_statuses = [
            STATUS_MAP.get(task_instance.state, StatusType.Pending.value)
            for task_instance in task_instances
        ]
        if any(status == StatusType.Pending.value for status in task_statuses):
            return StatusType.Pending.value
        if any(status == StatusType.Failed.value for status in task_statuses):
            return StatusType.Failed.value

        return StatusType.Successful.value

    def get_pipeline_status(
        self, task_instances: List["TaskInstance"]
    ) -> PipelineStatus:
        """
        Given the task instances for a run, prep the PipelineStatus
        """

        task_status = [
            TaskStatus(
                name=task_instance.task_id,
                executionStatus=STATUS_MAP.get(
                    task_instance.state, StatusType.Pending.value
                ),
                startTime=datetime_to_ts(task_instance.start_date),
                endTime=datetime_to_ts(task_instance.end_date),
                logLink=task_instance.log_url,
            )
            for task_instance in task_instances
        ]
        return PipelineStatus(
            # Use any of the task execution dates for the status execution date
            timestamp=datetime_to_ts(task_instances[0].execution_date),
            executionStatus=self.get_dag_status_from_task_instances(task_instances),
            taskStatus=task_status,
        )

    def add_all_pipeline_status(self, pipeline: Pipeline) -> None:
        """
        Get the latest Pipeline Status from the DAG and send
        it to OM
        """
        pipeline_status_list = self.get_all_pipeline_status()

        for status in pipeline_status_list:
            self.metadata.add_pipeline_status(
                fqn=pipeline.fullyQualifiedName.__root__, status=status
            )

    def get_xlets(self) -> XLets:
        """
        Fill the inlets and outlets of the Pipeline by iterating
        over all its tasks
        """
        _inlets = set()
        _outlets = set()

        for task in self.dag.tasks:
            _inlets.update(get_xlets(operator=task, xlet_mode="_inlets") or [])
            _outlets.update(get_xlets(operator=task, xlet_mode="_outlets") or [])

        return XLets(inlets=_inlets, outlets=_outlets)

    def add_lineage(self, pipeline: Pipeline, xlets: XLets) -> None:
        """
        Add the lineage from inlets and outlets
        """

        for table_fqn in xlets.inlets or []:
            table_entity = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
            try:
                lineage = AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(id=table_entity.id, type="table"),
                        toEntity=EntityReference(id=pipeline.id, type="pipeline"),
                    )
                )
                self.metadata.add_lineage(lineage)
            except AttributeError as err:
                self.dag.log.error(
                    f"Error trying to access Entity data due to: {err}."
                    f" Is the table [{table_fqn}] present in OpenMetadata?"
                )

        for table_fqn in xlets.outlets or []:
            table_entity = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
            try:
                lineage = AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(id=pipeline.id, type="pipeline"),
                        toEntity=EntityReference(id=table_entity.id, type="table"),
                    )
                )
                self.metadata.add_lineage(lineage)
            except AttributeError as err:
                self.dag.log.error(
                    f"Error trying to access Entity data due to: {err}."
                    f" Is the table [{table_fqn}] present in OpenMetadata?"
                )

    def clean_lineage(self, pipeline: Pipeline, xlets: XLets):
        """
        Clean the lineage nodes that are not part of xlets.

        We'll only clean up table nodes
        """
        lineage_data = self.metadata.get_lineage_by_name(
            entity=Pipeline,
            fqn=pipeline.fullyQualifiedName.__root__,
            up_depth=1,
            down_depth=1,
        )

        upstream_edges = [
            next(
                (
                    SimpleEdge(fqn=node["fullyQualifiedName"], id=node["id"])
                    for node in lineage_data.get("nodes") or []
                    if node["id"] == upstream_edge["fromEntity"]
                    and node["type"] == "table"
                )
            )
            for upstream_edge in lineage_data.get("upstreamEdges") or []
        ]
        downstream_edges = [
            next(
                (
                    SimpleEdge(fqn=node["fullyQualifiedName"], id=node["id"])
                    for node in lineage_data.get("nodes") or []
                    if node["id"] == downstream_edge["toEntity"]
                    and node["type"] == "table"
                )
            )
            for downstream_edge in lineage_data.get("downstreamEdges") or []
        ]

        for edge in upstream_edges:
            if edge.fqn not in xlets.inlets:
                self.dag.log.info(f"Removing upstream edge with {edge.fqn}")
                edge_to_remove = EntitiesEdge(
                    fromEntity=EntityReference(id=edge.id, type="table"),
                    toEntity=EntityReference(id=pipeline.id, type="pipeline"),
                )
                self.metadata.delete_lineage_edge(edge=edge_to_remove)

        for edge in downstream_edges:
            if edge.fqn not in xlets.outlets:
                self.dag.log.info(f"Removing downstream edge with {edge.fqn}")
                edge_to_remove = EntitiesEdge(
                    fromEntity=EntityReference(id=pipeline.id, type="pipeline"),
                    toEntity=EntityReference(id=edge.id, type="table"),
                )
                self.metadata.delete_lineage_edge(edge=edge_to_remove)

    def execute(self):
        """
        Run the whole ingestion logic
        """
        self.dag.log.info("Executing Airflow Lineage Runner...")
        pipeline_service = self.get_or_create_pipeline_service()
        pipeline = self.create_pipeline_entity(pipeline_service)
        self.add_all_pipeline_status(pipeline)

        xlets = self.get_xlets()
        self.add_lineage(pipeline, xlets)
        if self.only_keep_dag_lineage:
            self.dag.log.info(
                "`only_keep_dag_lineage` is set to True. Cleaning lineage not in inlets or outlets..."
            )
            self.clean_lineage(pipeline, xlets)
