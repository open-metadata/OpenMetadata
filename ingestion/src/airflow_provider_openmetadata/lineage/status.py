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
OpenMetadata Airflow Provider utilities
"""

from typing import TYPE_CHECKING, Dict, List

from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    TaskStatus,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.helpers import datetime_to_ts

if TYPE_CHECKING:
    from airflow import DAG
    from airflow.models.baseoperator import BaseOperator
    from airflow.models.dagrun import DagRun
    from airflow.models.taskinstance import TaskInstance


STATUS_MAP = {
    "success": StatusType.Successful.value,
    "failed": StatusType.Failed.value,
    "queued": StatusType.Pending.value,
}


def get_dag_status(all_tasks: List[str], task_status: List[TaskStatus]):
    """
    Based on the task information and the total DAG tasks, cook the
    DAG status.
    We are not directly using `context["dag_run"]._state` as it always
    gets flagged as "running" during the callbacks.
    """

    if len(all_tasks) < len(task_status):
        raise ValueError(
            "We have more status than children:"
            + f"children {all_tasks} vs. status {task_status}"
        )

    # We are still processing tasks...
    if len(all_tasks) > len(task_status):
        return StatusType.Pending

    # Check for any failure if all tasks have been processed
    if len(all_tasks) == len(task_status) and StatusType.Failed in {
        task.executionStatus for task in task_status
    }:
        return StatusType.Failed

    return StatusType.Successful


def add_status(
    operator: "BaseOperator",
    pipeline: Pipeline,
    metadata: OpenMetadata,
    context: Dict,
) -> None:
    """
    Add status information for this execution date
    """

    dag: "DAG" = context["dag"]
    dag_run: "DagRun" = context["dag_run"]
    task_instance: "TaskInstance" = context["task_instance"]

    # Let this fail if we cannot properly extract & cast the start_date
    execution_date = datetime_to_ts(dag_run.execution_date)
    operator.log.info(f"Logging pipeline status for execution {execution_date}")

    # Check if we already have a pipelineStatus for
    # our execution_date that we should update
    pipeline_status: PipelineStatus = metadata.get_by_id(
        entity=Pipeline, entity_id=pipeline.id, fields=["pipelineStatus"]
    ).pipelineStatus

    task_status = []
    # We will append based on the current registered status
    if pipeline_status and pipeline_status.timestamp.__root__ == execution_date:
        # If we are clearing a task, use the status of the new execution
        task_status = [
            task
            for task in pipeline_status.taskStatus
            if task.name != task_instance.task_id
        ]

    # Prepare the new task status information based on the tasks already
    # visited and the current task
    updated_task_status = [
        TaskStatus(
            name=task_instance.task_id,
            executionStatus=STATUS_MAP.get(task_instance.state),
            startTime=datetime_to_ts(task_instance.start_date),
            endTime=datetime_to_ts(task_instance.end_date),
            logLink=task_instance.log_url,
        ),
        *task_status,
    ]

    updated_status = PipelineStatus(
        timestamp=execution_date,
        executionStatus=get_dag_status(
            all_tasks=dag.task_ids,
            task_status=updated_task_status,
        ),
        taskStatus=updated_task_status,
    )

    operator.log.info(f"Added status to DAG {updated_status}")
    metadata.add_pipeline_status(
        fqn=pipeline.fullyQualifiedName.__root__, status=updated_status
    )
