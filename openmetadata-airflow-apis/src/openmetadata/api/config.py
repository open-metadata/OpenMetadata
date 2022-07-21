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
Airflow config
"""

import socket

import airflow
from airflow.configuration import conf
from openmetadata import __version__

REST_API_ENDPOINT = "/rest_api/api"

# Getting Versions and Global variables
HOSTNAME = socket.gethostname()
AIRFLOW_VERSION = airflow.__version__
REST_API_PLUGIN_VERSION = __version__

# Getting configurations from airflow.cfg file
AIRFLOW_WEBSERVER_BASE_URL = conf.get("webserver", "BASE_URL")
AIRFLOW_DAGS_FOLDER = conf.get("core", "DAGS_FOLDER")
DAG_RUNNER_TEMPLATE = conf.get("openmetadata_airflow_apis", "DAG_RUNNER_TEMPLATE")
# Path to store the JSON configurations we receive via REST
DAG_GENERATED_CONFIGS = conf.get("openmetadata_airflow_apis", "DAG_GENERATED_CONFIGS")
