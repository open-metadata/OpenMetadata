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
from datetime import timedelta

from airflow import DAG
from docker.types import Mount

try:
    from airflow.operators.docker_operator import DockerOperator
except ModuleNotFoundError:
    from airflow.providers.docker.operators.docker import DockerOperator

from airflow.utils.dates import days_ago

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(seconds=10),
    "execution_timeout": timedelta(minutes=60),
}

config = """
{
  "source": {
    "type": "sample-data",
    "config": {
      "sample_data_folder": "/opt/operator/sample_data"
    }
  },
  "sink": {
    "type": "metadata-rest",
    "config": {}
  },
  "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
      "auth_provider_type": "no-auth"
    }
  }
}
"""


with DAG(
    "sample_data",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    catchup=False,
) as dag:
    ingest_task = DockerOperator(
        task_id="ingest_using_docker",
        image="openmetadata/ingestion-connector-base",
        command="python main.py",
        environment={"config": config},
        tty=True,
        auto_remove=True,
        mounts=[
            Mount(
                source="/tmp/openmetadata/examples/",
                target="/opt/operator/",
                type="bind",
            ),
        ],
        mount_tmp_dir=False,
        network_mode="host",  # Needed to reach Docker OM
    )
