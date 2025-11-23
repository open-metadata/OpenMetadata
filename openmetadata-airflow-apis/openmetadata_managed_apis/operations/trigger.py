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
Module containing the logic to trigger a DAG
"""
import inspect
from typing import Optional

try:
    from airflow.api.common.trigger_dag import trigger_dag
except ImportError:
    from airflow.api.common.experimental.trigger_dag import trigger_dag

from airflow.utils import timezone
from flask import Response
from openmetadata_managed_apis.api.response import ApiResponse

try:
    from airflow.models.dagrun import DagRunTriggeredByType
except ImportError:
    DagRunTriggeredByType = None  # type: ignore[misc,assignment]


def trigger(
    dag_id: str, run_id: Optional[str], conf: Optional[dict] = None
) -> Response:
    trigger_params = {
        "dag_id": dag_id,
        "run_id": run_id,
        "conf": conf,
    }

    # In Airflow 3.x and 2.2+, execution_date was replaced with logical_date
    # Check the function signature to determine which parameter to use
    trigger_sig = inspect.signature(trigger_dag)
    if "logical_date" in trigger_sig.parameters:
        trigger_params["logical_date"] = timezone.utcnow()
    else:
        # Fallback for older Airflow versions
        trigger_params["execution_date"] = timezone.utcnow()

    if "triggered_by" in trigger_sig.parameters:
        if DagRunTriggeredByType:
            # Airflow 3.x uses REST_API, Airflow 2.x uses API
            try:
                trigger_params["triggered_by"] = DagRunTriggeredByType.REST_API
            except AttributeError:
                # Fallback to API for older Airflow 2.x versions
                trigger_params["triggered_by"] = DagRunTriggeredByType.API
        else:
            trigger_params["triggered_by"] = "OpenMetadata"

    dag_run = trigger_dag(**trigger_params)
    return ApiResponse.success(
        {"message": f"Workflow [{dag_id}] has been triggered {dag_run}"}
    )
