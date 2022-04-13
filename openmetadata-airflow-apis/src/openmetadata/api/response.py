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

import json
from typing import Optional

from airflow.models import DagRun
from flask import Response


class ApiResponse:
    """
    Helper class to respond API calls
    """

    def __init__(self):
        pass

    STATUS_OK = 200
    STATUS_BAD_REQUEST = 400
    STATUS_UNAUTHORIZED = 401
    STATUS_NOT_FOUND = 404
    STATUS_SERVER_ERROR = 500

    @staticmethod
    def standard_response(status, response_obj):
        json_data = json.dumps(response_obj)
        resp = Response(json_data, status=status, mimetype="application/json")
        return resp

    @staticmethod
    def success(response_obj: Optional[dict] = None):
        if not response_obj:
            response_obj = {}

        response_obj["status"] = "success"
        return ApiResponse.standard_response(ApiResponse.STATUS_OK, response_obj)

    @staticmethod
    def error(status, error):
        return ApiResponse.standard_response(status, {"error": error})

    @staticmethod
    def bad_request(error):
        return ApiResponse.error(ApiResponse.STATUS_BAD_REQUEST, error)

    @staticmethod
    def not_found(error="Resource not found"):
        return ApiResponse.error(ApiResponse.STATUS_NOT_FOUND, error)

    @staticmethod
    def unauthorized(error="Not authorized to access this resource"):
        return ApiResponse.error(ApiResponse.STATUS_UNAUTHORIZED, error)

    @staticmethod
    def server_error(error="An unexpected problem occurred"):
        return ApiResponse.error(ApiResponse.STATUS_SERVER_ERROR, error)


class ResponseFormat:
    def __init__(self):
        pass

    @staticmethod
    def format_dag_run_state(dag_run: DagRun):
        return {
            "state": dag_run.get_state(),
            "run_id": dag_run.run_id,
            "startDate": (
                None
                if not dag_run.start_date
                else dag_run.start_date.strftime("%Y-%m-%dT%H:%M:%S.%f%z")
            ),
            "endDate": (
                None
                if not dag_run.end_date
                else dag_run.end_date.strftime("%Y-%m-%dT%H:%M:%S.%f%z")
            ),
        }

    @staticmethod
    def format_dag_task(task_instance):
        return {
            "taskId": task_instance.task_id,
            "dagId": task_instance.dag_id,
            "state": task_instance.state,
            "tryNumber": (
                None
                if not task_instance._try_number
                else str(task_instance._try_number)
            ),
            "maxTries": (
                None if not task_instance.max_tries else str(task_instance.max_tries)
            ),
            "startDate": (
                None
                if not task_instance.start_date
                else task_instance.start_date.strftime("%Y-%m-%dT%H:%M:%S.%f%z")
            ),
            "endDate": (
                None
                if not task_instance.end_date
                else task_instance.end_date.strftime("%Y-%m-%dT%H:%M:%S.%f%z")
            ),
            "duration": (
                None if not task_instance.duration else str(task_instance.duration)
            ),
        }
