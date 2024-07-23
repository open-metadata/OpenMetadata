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
from datetime import timedelta

from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from airflow.utils.dates import days_ago

from metadata.workflow.usage import UsageWorkflow

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
    "type": "custom-database",
    "serviceName": "sample_data",
    "serviceConnection": {
      "config": {
        "type": "CustomDatabase",
        "sourcePythonClass": "metadata.ingestion.source.database.sample_usage.SampleUsageSource",
        "connectionOptions": {
          "sampleDataFolder": "/home/airflow/ingestion/examples/sample_data"
        }
      }
    },
    "sourceConfig": {
      "config":{
        "type": "DatabaseUsage"
      }
    }
  },
  "processor": {
    "type": "query-parser",
    "config": {}
  },
  "stage": {
    "type": "table-usage",
    "config": {
      "filename": "/tmp/sample_usage"
    }
  },
  "bulkSink": {
    "type": "metadata-usage",
    "config": {
      "filename": "/tmp/sample_usage"
    }
  },
  "workflowConfig": {
    "openMetadataServerConfig": {
      "hostPort": "http://openmetadata-server:8585/api",
      "authProvider": "openmetadata",
      "securityConfig":{
          "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
      }
    }
  }
}
"""


def metadata_ingestion_workflow():
    workflow_config = json.loads(config)
    workflow = UsageWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


with DAG(
    "sample_usage",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    schedule_interval=timedelta(days=1),
    start_date=days_ago(1),
    is_paused_upon_creation=True,
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )
