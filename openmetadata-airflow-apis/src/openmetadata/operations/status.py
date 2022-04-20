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
Module containing the logic to check a DAG status
"""
import json
from typing import Optional

from airflow import settings
from airflow.models import DagRun
from flask import Response
from openmetadata.api.response import ApiResponse, ResponseFormat

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineStatus,
)


def status(dag_id: str, run_id: Optional[str]) -> Response:

    with settings.Session() as session:

        query = session.query(DagRun)

        if run_id:

            dag_run = query.filter(
                DagRun.dag_id == dag_id, DagRun.run_id == run_id
            ).first()

            if dag_run is None:
                return ApiResponse.not_found(f"DAG run {run_id} not found")

            res_dag_run: PipelineStatus = ResponseFormat.format_dag_run_state(dag_run)

            return ApiResponse.success(json.loads(res_dag_run.json()))

        runs = (
            query.filter(
                DagRun.dag_id == dag_id,
            )
            .order_by(DagRun.start_date.desc())
            .limit(10)
            .all()
        )

        formatted = [
            json.loads(ResponseFormat.format_dag_run_state(dag_run).json())
            for dag_run in runs
        ]

        return ApiResponse.success(formatted)
