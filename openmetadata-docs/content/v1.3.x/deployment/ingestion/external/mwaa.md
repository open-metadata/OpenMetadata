---
title: Run the ingestion from AWS MWAA
slug: /deployment/ingestion/external/mwaa
---

{% partial file="/v1.3/deployment/external-ingestion.md" /%}

# Run the ingestion from AWS MWAA

When running ingestion workflows from MWAA we have three approaches:

1. Install the openmetadata-ingestion package as a requirement in the Airflow environment. We will then run the process using a `PythonOperator`
2. Configure an ECS cluster and run the ingestion as an `ECSOperator`.
3. Install a plugin and run the ingestion with the `PythonVirtualenvOperator`.

We will now discuss pros and cons of each aspect and how to configure them.

## Ingestion Workflows as a Python Operator

### PROs

- It is the simplest approach
- We don’t need to spin up any further infrastructure

### CONs

- We need to install the [openmetadata-ingestion](https://pypi.org/project/openmetadata-ingestion/) package in the MWAA environment
- The installation can clash with existing libraries
- Upgrading the OM version will require to repeat the installation process

To install the package, we need to update the `requirements.txt` file from the MWAA environment to add the following line:

```
openmetadata-ingestion[<plugin>]==x.y.z
```

Where `x.y.z` is the version of the OpenMetadata ingestion package. Note that the version needs to match the server version. If we are using the server at 1.3.1, then the ingestion package needs to also be 1.3.1.

The plugin parameter is a list of the sources that we want to ingest. An example would look like this `openmetadata-ingestion[mysql,snowflake,s3]==1.3.1`.

A DAG deployed using a Python Operator would then look like follows

```python
import json
from datetime import timedelta

from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from airflow.utils.dates import days_ago

from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.workflow_output_handler import print_status

default_args = {
    "retries": 3,
    "retry_delay": timedelta(seconds=10),
    "execution_timeout": timedelta(minutes=60),
}

config = """
YAML config
"""

def metadata_ingestion_workflow():
    workflow_config = json.loads(config)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    print_status(workflow)
    workflow.stop()

with DAG(
    "redshift_ingestion",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_redshift",
        python_callable=metadata_ingestion_workflow,
    )
```

Where you can update the YAML configuration and workflow classes accordingly. accordingly. Further examples on how to 
run the ingestion can be found on the documentation (e.g., [Snowflake](https://docs.open-metadata.org/connectors/database/snowflake)).

{% partial file="/v1.3/deployment/run-connectors-class.md" /%}

## Ingestion Workflows as an ECS Operator

### PROs
- Completely isolated environment
- Easy to update each version

### CONs
- We need to set up an ECS cluster and the required policies in MWAA to connect to ECS and handle Log Groups.

We will now describe the steps, following the official AWS documentation.

### 1. Create an ECS Cluster & Task Definition

- The cluster needs a task to run in `FARGATE` mode.
- The required image is `docker.getcollate.io/openmetadata/ingestion-base:x.y.z`
  - The same logic as above applies. The `x.y.z` version needs to match the server version. For example, `docker.getcollate.io/openmetadata/ingestion-base:1.3.1`
  
We have tested this process with a Task Memory of 512MB and Task CPU (unit) of 256. This can be tuned depending on the amount of metadata that needs to be ingested.

When creating the Task Definition, take notes on the **log groups** assigned, as we will need them to prepare the MWAA Executor Role policies.

For example, if in the JSON from the Task Definition we see:

```json
"logConfiguration": {
    "logDriver": "awslogs",
    "options": {
        "awslogs-create-group": "true",
        "awslogs-group": "/ecs/openmetadata",
        "awslogs-region": "us-east-2",
        "awslogs-stream-prefix": "ecs"
    },
    "secretOptions": []
}
```

We'll need to use the `/ecs/openmetadata` below when configuring the policies.

### 2. Task Definition ARN & Networking

1. From the AWS Console, copy your task definition ARN. It will look something like this `arn:aws:ecs:<region>:<account>:task-definition/<name>:<revision>`.
2. Get the network details on where the task should execute. We will be using a JSON like:

```json
{
  "awsvpcConfiguration": {
    "subnets": [
      "subnet-xxxyyyzzz",
      "subnet-xxxyyyzzz"
    ],
    "securityGroups": [
      "sg-xxxyyyzzz"
    ],
    "assignPublicIp": "ENABLED"
  }
}
```

{% note %}

If you want to extract MWAA metadata, add the **VPC**, **subnets** and **security groups** used when setting up MWAA. We need to
be in the same network environment as MWAA to reach the underlying database.

{% /note %}

### 3. Update MWAA Executor Role policies

- Identify your MWAA executor role. This can be obtained from the details view of your MWAA environment.
- Add the following two policies to the role, the first with ECS permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "ecs:RunTask",
                "ecs:DescribeTasks"
            ],
            "Resource": "*"
        },
        {
            "Action": "iam:PassRole",
            "Effect": "Allow",
            "Resource": [
                "*"
            ],
            "Condition": {
                "StringLike": {
                    "iam:PassedToService": "ecs-tasks.amazonaws.com"
                }
            }
        }
    ]
}
```


And for the Log Group permissions

```json
{
    "Effect": "Allow",
    "Action": [
        "logs:CreateLogStream",
        "logs:CreateLogGroup",
        "logs:PutLogEvents",
        "logs:GetLogEvents",
        "logs:GetLogRecord",
        "logs:GetLogGroupFields",
        "logs:GetQueryResults"
    ],
    "Resource": [
        "arn:aws:logs:<region>:<account-id>:log-group:<airflow-environment-name>*",
        "arn:aws:logs:*:*:log-group:<ecs-mwaa-group>:*"
    ]
}
                
```

Note how you need to replace the `region`, `account-id` and the `log group` names for your Airflow Environment and ECS.

### 4. Prepare the DAG

A DAG created using the ECS Operator will then look like this:

```python
from airflow import DAG
# If using Airflow < 2.5
# from airflow.providers.amazon.aws.operators.ecs import ECSOperator
# If using Airflow > 2.5
from airflow.providers.amazon.aws.operators.ecs import EcsRunTaskOperator
from airflow.utils.dates import days_ago


CLUSTER_NAME="openmetadata-ingestion"  # Replace value for CLUSTER_NAME with your information.
CONTAINER_NAME="openmetadata-ingestion"  # Replace value for CONTAINER_NAME with your information.
LAUNCH_TYPE="FARGATE"

TASK_DEFINITION = "arn:aws:ecs:<region>:<account>:task-definition/<name>:<revision>"
NETWORK_CONFIG = {
  "awsvpcConfiguration": {
    "subnets": [
      "subnet-xxxyyyzzz",
      "subnet-xxxyyyzzz"
    ],
    "securityGroups": [
      "sg-xxxyyyzzz"
    ],
    "assignPublicIp": "ENABLED"
  }
}

config = """
YAML config
"""


with DAG(
    dag_id="ecs_fargate_dag",
    schedule_interval=None,
    catchup=False,
    start_date=days_ago(1),
    is_paused_upon_creation=True,
) as dag:
    ecs_operator_task = EcsRunTaskOperator(
        task_id = "ecs_ingestion_task",
        dag=dag,
        cluster=CLUSTER_NAME,
        task_definition=TASK_DEFINITION,
        launch_type=LAUNCH_TYPE,
        overrides={
            "containerOverrides":[
                {
                    "name":CONTAINER_NAME,
                    "command":["python", "main.py"],
                    "environment": [
                      {
                        "name": "config",
                        "value": config
                      },
                      {
                        "name": "pipelineType",
                        "value": "metadata"
                      },
                    ],
                },
            ],
        },

        network_configuration=NETWORK_CONFIG,
        awslogs_group="/ecs/ingest",
        awslogs_stream_prefix=f"ecs/{CONTAINER_NAME}",
    )
```

Note that depending on the kind of workflow you will be deploying, the YAML configuration will need to updated following 
the official OpenMetadata docs, and the value of the `pipelineType` configuration will need to hold one of the following values:

- `metadata`
- `usage`
- `lineage`
- `profiler`
- `TestSuite`

Which are based on the `PipelineType` [JSON Schema definitions](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/ingestionPipelines/ingestionPipeline.json#L14)

Moreover, one of the imports will depend on the MWAA Airflow version you are using:
- If using Airflow < 2.5: `from airflow.providers.amazon.aws.operators.ecs import ECSOperator`
- If using Airflow > 2.5: `from airflow.providers.amazon.aws.operators.ecs import EcsRunTaskOperator`

Make sure to update the `ecs_operator_task` task call accordingly.

## Ingestion Workflows as a Python Virtualenv Operator

### PROs

- Installation does not clash with existing libraries
- Simpler than ECS

### CONs

- We need to install an additional plugin in MWAA
- DAGs take longer to run due to needing to set up the virtualenv from scratch for each run.

We need to update the `requirements.txt` file from the MWAA environment to add the following line:

```
virtualenv
```

Then, we need to set up a custom plugin in MWAA. Create a file named virtual_python_plugin.py. Note that you may need to update the python version (eg, python3.7 -> python3.10) depending on what your MWAA environment is running.
```python
"""
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
"""
from airflow.plugins_manager import AirflowPlugin
import airflow.utils.python_virtualenv
from typing import List
import os


def _generate_virtualenv_cmd(tmp_dir: str, python_bin: str, system_site_packages: bool) -> List[str]:
    cmd = ['python3', '/usr/local/airflow/.local/lib/python3.7/site-packages/virtualenv', tmp_dir]
    if system_site_packages:
        cmd.append('--system-site-packages')
    if python_bin is not None:
        cmd.append(f'--python={python_bin}')
    return cmd


airflow.utils.python_virtualenv._generate_virtualenv_cmd = _generate_virtualenv_cmd

os.environ["PATH"] = f"/usr/local/airflow/.local/bin:{os.environ['PATH']}"


class VirtualPythonPlugin(AirflowPlugin):
    name = 'virtual_python_plugin'
```

This is modified from the [AWS sample](https://docs.aws.amazon.com/mwaa/latest/userguide/samples-virtualenv.html).

Next, create the plugins.zip file and upload it according to [AWS docs](https://docs.aws.amazon.com/mwaa/latest/userguide/configuring-dag-import-plugins.html). You will also need to [disable lazy plugin loading in MWAA](https://docs.aws.amazon.com/mwaa/latest/userguide/samples-virtualenv.html#samples-virtualenv-airflow-config).

A DAG deployed using the PythonVirtualenvOperator would then look like:

```python
from datetime import timedelta

from airflow import DAG

from airflow.operators.python import PythonVirtualenvOperator

from airflow.utils.dates import days_ago


default_args = {
    "retries": 3,
    "retry_delay": timedelta(seconds=10),
    "execution_timeout": timedelta(minutes=60),
}

def metadata_ingestion_workflow():
    from metadata.workflow.metadata import MetadataWorkflow
    from metadata.workflow.workflow_output_handler import print_status
    
    import yaml
    
    config = """
YAML config
    """
    workflow_config = yaml.loads(config)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    print_status(workflow)
    workflow.stop()

with DAG(
    "redshift_ingestion",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    catchup=False,
) as dag:
    ingest_task = PythonVirtualenvOperator(
        task_id="ingest_redshift",
        python_callable=metadata_ingestion_workflow,
        requirements=['openmetadata-ingestion==1.0.5.0',
            'apache-airflow==2.4.3',  # note, v2.4.3 is the first version that does not conflict with OpenMetadata's 'tabulate' requirements
            'apache-airflow-providers-amazon==6.0.0',  # Amazon Airflow provider is necessary for MWAA 
            'watchtower',],
        system_site_packages=False,
        dag=dag,
    )
```

Where you can update the YAML configuration and workflow classes accordingly. accordingly. Further examples on how to
run the ingestion can be found on the documentation (e.g., [Snowflake](https://docs.open-metadata.org/connectors/database/snowflake)).

You will also need to determine the OpenMetadata ingestion extras and Airflow providers you need. Note that the Openmetadata version needs to match the server version. If we are using the server at 0.12.2, then the ingestion package needs to also be 0.12.2.  An example of the extras would look like this `openmetadata-ingestion[mysql,snowflake,s3]==0.12.2.2`.
For Airflow providers, you will want to pull the provider versions from [the matching constraints file](https://raw.githubusercontent.com/apache/airflow/constraints-2.4.3/constraints-3.7.txt). Since this example installs Airflow Providers v2.4.3 on Python 3.7, we use that constraints file.

Also note that the ingestion workflow function must be entirely self-contained as it will run by itself in the virtualenv. Any imports it needs, including the configuration, must exist within the function itself.

{% partial file="/v1.3/deployment/run-connectors-class.md" /%}
