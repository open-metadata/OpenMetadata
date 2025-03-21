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
Module containing the logic to trigger a DAG
"""
from typing import Optional

from openmetadata_managed_apis.utils.logger import operations_logger

try:
    from airflow.api.common.trigger_dag import trigger_dag
except ImportError:
    from airflow.api.common.experimental.trigger_dag import trigger_dag
from airflow.utils import timezone
from flask import Response
from openmetadata_managed_apis.api.response import ApiResponse
from airflow.models import DagRun
from airflow.utils.session import create_session

logger = operations_logger()


def trigger(dag_id: str, run_id: Optional[str], conf: Optional[dict] = None) -> Response:

    if conf:
        with create_session() as session:
            most_recent_run = session.query(DagRun).filter(
                DagRun.dag_id == dag_id
            ).order_by(DagRun.execution_date.desc()).first()

            if most_recent_run and most_recent_run.conf:
                # Start with the most recent configuration
                merged_conf = most_recent_run.conf.copy()
                # Update only the root-level keys
                merged_conf.update(conf)
            else:
                merged_conf = conf

    dag_run = trigger_dag(
        dag_id=dag_id,
        run_id=run_id,
        conf=merged_conf,
        execution_date=timezone.utcnow(),
    )
    return ApiResponse.success(
        {"message": f"Workflow [{dag_id}] has been triggered {dag_run}"}
    )
