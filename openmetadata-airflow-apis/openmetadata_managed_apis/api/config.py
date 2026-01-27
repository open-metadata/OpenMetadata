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
Airflow config
"""
import os
import socket

import airflow
from airflow.configuration import conf
from openmetadata_managed_apis import __version__
from openmetadata_managed_apis.utils.airflow_version import (
    get_base_url_config,
    is_airflow_3_or_higher,
)

PLUGIN_NAME = "openmetadata_managed_apis"
REST_API_ENDPOINT = (
    "/api/v2/openmetadata/" if is_airflow_3_or_higher() else "/api/v1/openmetadata/"
)

# Getting Versions and Global variables
HOSTNAME = socket.gethostname()
AIRFLOW_VERSION = airflow.__version__
REST_API_PLUGIN_VERSION = __version__

# Getting configurations from airflow.cfg file
# In Airflow 3.x, BASE_URL moved from [webserver] to [api] section
section, key = get_base_url_config()
try:
    AIRFLOW_WEBSERVER_BASE_URL = conf.get(section, key)
except Exception:
    # Fallback: Try the alternate section (Airflow 2.x vs 3.x)
    alternate_section = "webserver" if section == "api" else "api"
    try:
        AIRFLOW_WEBSERVER_BASE_URL = conf.get(alternate_section, key)
    except Exception:
        # If base_url is not configured in either section, use environment variable or default
        AIRFLOW_WEBSERVER_BASE_URL = os.getenv(
            "AIRFLOW_WEBSERVER_BASE_URL", "http://localhost:8080"
        )
AIRFLOW_DAGS_FOLDER = conf.get("core", "DAGS_FOLDER")
# Path to store the JSON configurations we receive via REST
DAG_GENERATED_CONFIGS = conf.get(
    "openmetadata_airflow_apis",
    "DAG_GENERATED_CONFIGS",
    fallback=f"{os.environ['AIRFLOW_HOME']}/dag_generated_configs",
)
