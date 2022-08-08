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
Health endpoint. Globally accessible
"""
import traceback

from airflow.www.app import csrf
from openmetadata_managed_apis.api.app import blueprint
from openmetadata_managed_apis.api.response import ApiResponse


@blueprint.route("/health", methods=["GET"])
@csrf.exempt
def health():
    """
    /health endpoint to check Airflow REST status without auth
    """

    try:
        return ApiResponse.success({"status": "healthy"})
    except Exception as err:
        return ApiResponse.error(
            status=ApiResponse.STATUS_SERVER_ERROR,
            error=f"Internal error obtaining REST status - {err} - {traceback.format_exc()}",
        )
