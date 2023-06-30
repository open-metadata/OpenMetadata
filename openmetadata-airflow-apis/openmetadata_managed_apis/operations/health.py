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
Common health validation, for auth and non-auth endpoint
"""
import traceback

from openmetadata_managed_apis.utils.logger import operations_logger

try:
    from importlib.metadata import version
except ImportError:
    from importlib_metadata import version

from openmetadata_managed_apis.api.response import ApiResponse

logger = operations_logger()


def health_response():
    try:
        return ApiResponse.success(
            {"status": "healthy", "version": version("openmetadata-ingestion")}
        )
    except Exception as exc:
        msg = f"Error obtaining Airflow REST status due to [{exc}] "
        logger.debug(traceback.format_exc())
        logger.error(msg)
        return ApiResponse.error(
            status=ApiResponse.STATUS_BAD_REQUEST,
            error=msg,
        )
