---
title: Run Connectors from MWAA
slug: /connectors/ingestion/run-connectors-from-mwaa
---

# Run Connectors from MWAA

When running ingestion workflows from MWAA we have two main approaches:
1. Install the oprenmetadata-ingestion package as a requirement in the Airflow environment. We will then run the process using a `PythonOperator`
2. Configure an ECS cluster and run the ingestion as an `ECSOperator`.

We will now discuss pros and cons of each aspect and how to configure them.

## Ingestion Workflows as a Python Operator

### PROs

- It is the simplest approach
- We don’t need to spin up any further infrastructure
- If there are no requirements issues, this would be the simpler and preferred approach.

### CONs

- We need to install the [openmetadata-ingestion](https://pypi.org/project/openmetadata-ingestion/) package in the MWAA environment
- The installation can clash with existing libraries
- Upgrading the OM version will require to repeat the installation process

To install the package, we need to update the `requirements.txt` file from the MWAA environment to add the following line:

```
openmetadata-ingestion[<plugin>]==x.y.z
```

Where `x.y.z` is the version of the OpenMetadata ingestion package. Note that the version needs to match the server version. If we are using the server at 0.12.2, then the ingestion package needs to also be 0.12.2.

The plugin parameter is a list of the sources that we want to ingest. An example would look like this `openmetadata-ingestion[mysql,snowflake,s3]==0.12.2.2`.

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

from metadata.ingestion.api.workflow import Workflow

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
    workflow = Workflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
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

### Extracting MWAA Metadata

As the ingestion process will be happening locally in MWAA, we can prepare a DAG with the following YAML
configuration:

```yaml
source:
  type: airflow
  serviceName: airflow_mwaa
  serviceConnection:
    config:
      type: Airflow
      hostPort: http://localhost:8080
      numberOfStatus: 10
      connection:
        type: Backend
  sourceConfig:
    config:
      type: PipelineMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  loggerLevel: INFO
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

Using the connection type `Backend` will pick up the Airflow database session directly at runtime.

## Ingestion Workflows as an ECS Operator

### PROs
- Completely isolated environment
- Easy to update each version

### CONs
- We need to set up an ECS cluster and the required policies in MWAA to connect to ECS and handle Log Groups.

We will now describe the steps, following the official AWS documentation.

### 1. Create an ECS Cluster

Note that all this process has been extracted from the official AWS [docs](https://docs.aws.amazon.com/mwaa/latest/userguide/samples-ecs-operator.html).

Summary of the steps:
- The cluster just needs a task to run in `FARGATE` mode.
- The required image is `docker.getcollate.io/openmetadata/ingestion-base:x.y.z`
  - The same logic as above applies. The `x.y.z` version needs to match the server version. For example, `docker.getcollate.io/openmetadata/ingestion-base:0.13.2`

When creating the ECS Cluster, take notes on the log groups assigned, as we will need them to prepare the MWAA Executor Role policies.

We'll now show screenshots on the steps you need to take:

#### 1.1 Create the ECS Task Definition

First, create the Task Definition in ECS with the following configurations. This is where we'll specify
the docker image. For example, `docker.getcollate.io/openmetadata/ingestion-base:0.13.2`.

<Image src="/images/openmetadata/connectors/deployment/create-ecs-task.png" alt="Create ECS Task Definition"/>

<Image src="/images/openmetadata/connectors/deployment/create-ecs-task2.png" alt="Create ECS Task Definition Config"/>

#### 1.2 Create the ECS Cluster

Then, create the cluster. Make sure to specify the same VPC and subnets that you are using in your MWAA environment.

<Image src="/images/openmetadata/connectors/deployment/create-ecs-cluster.png" alt="Create ECS Cluster"/>

#### 1.3 Create the ECS Service

Finally, we'll need to create a Service. This is what the DAG in MWAA will trigger when it executes. Note that in the
networking, we are again specifying the MWAA network settings and the same security group. Also, the public IP
needs to be enabled.

<Image src="/images/openmetadata/connectors/deployment/create-ecs-service.png" alt="Create ECS Service"/>

<Image src="/images/openmetadata/connectors/deployment/create-ecs-service-networking.png" alt="Create ECS Service Networking"/>


### 2. Update MWAA Executor Role policies

Identify your MWAA executor role. This can be obtained from the details view of your MWAA environment. 

First, add the following two policies to the role: [AmazonECS_FullAccess](https://us-east-1.console.aws.amazon.com/iam/home#/policies/arn:aws:iam::aws:policy/AmazonECS_FullAccess$jsonEditor).

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
        "arn:aws:logs:<region>:<account-id>:log-group:<airflow-environment-name->*",
        "arn:aws:logs:*:*:log-group:<ecs-mwaa-group>:*"
    ]
}
                
```

Note how you need to replace the `region`, `account-id` and the `log group` names for your Airflow Environment and ECS cluster name.

A DAG created using the ECS Operator will then look like this:

```python
from datetime import datetime

import yaml
from airflow import DAG

from http import client
from airflow import DAG
from airflow.providers.amazon.aws.operators.ecs import ECSOperator
from airflow.utils.dates import days_ago
import boto3


CLUSTER_NAME="openmetadata-ingestion-cluster"  # Replace value for CLUSTER_NAME with your information.
CONTAINER_NAME="openmetadata-ingestion"  # Replace value for CONTAINER_NAME with your information.
LAUNCH_TYPE="FARGATE"

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
    client=boto3.client('ecs')
    services=client.list_services(cluster=CLUSTER_NAME,launchType=LAUNCH_TYPE)
    service=client.describe_services(cluster=CLUSTER_NAME,services=services['serviceArns'])
    ecs_operator_task = ECSOperator(
        task_id = "ecs_ingestion_task",
        dag=dag,
        cluster=CLUSTER_NAME,
        task_definition=service['services'][0]['taskDefinition'],
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

        network_configuration=service['services'][0]['networkConfiguration'],
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

### Extracting MWAA Metadata

To extract MWAA information we will need to take a couple of points in consideration:
1. How to get the underlying database connection info, and
2. How to make sure we can reach such database.

#### Getting the DB connection

The happy path would be going to the `Airflow UI > Admin > Configurations` and finding the `sql_alchemy_conn` parameter.

However, MWAA is not providing this information. Instead, we need to create a DAG to get the connection details
once. The DAG can be deleted afterwards. We want to use a Python Operator that will retrieve the Airflow's Session data:

```python
import logging
import os
from datetime import timedelta

import yaml
from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from airflow.utils.dates import days_ago

from airflow.configuration import conf

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=60),
}

def get_data():
    from airflow.settings import Session
    
    session = Session()
    engine = session.bind
    url = engine.url

    logging.info("SQL ALCHEMY CONN")
    sqlalchemy_conn = conf.get("core", "sql_alchemy_conn", fallback=None)
    logging.info(sqlalchemy_conn)
    
    # MWAA masks the password, so we need to bypass their masking
    logging.info("Get the password from this list")
    logging.warning(list(url.password))


with DAG(
    "airflow_database_connection",
    default_args=default_args,
    description="An example DAG which pushes Airflow data to OM",
    start_date=days_ago(1),
    is_paused_upon_creation=True,
    schedule_interval="@once",
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="db_connection",
        python_callable=get_data,
    )
```

After running the DAG, we can store the connection details and remove the dag file from S3.

Note that we need to bypass MWAA security when logging the password. This process might need to change in the future.

#### Preparing the metadata extraction

We will use ECS here as well to get the metadata out of MWAA. The only important detail is to ensure that we are
using the right networking.

When creating the ECS cluster, add the VPC, subnets and security groups used when setting up MWAA. We need to
be in the same network environment as MWAA to reach the underlying database. In the task information, we'll configure the
same task we did for the previous metadata extraction.

Now, we are ready to prepare the DAG to extract MWAA metadata:

```python
from datetime import datetime

import yaml
from airflow import DAG

from http import client
from airflow import DAG
from airflow.providers.amazon.aws.operators.ecs import ECSOperator
from airflow.utils.dates import days_ago
import boto3


CLUSTER_NAME="<your cluster name>"
CONTAINER_NAME="<your container name>"
LAUNCH_TYPE="FARGATE"
LOG_GROUP="<your log group>"

config = """
source:
  type: airflow
  serviceName: airflow_mwaa_ecs_op
  serviceConnection:
    config:
      type: Airflow
      hostPort: http://localhost:8080
      numberOfStatus: 10
      connection:
        type: Postgres
        username: adminuser
        password: <Extracted from the step above>
        hostPort: vpce-...-c88g16we.vpce-svc-....us-east-2.vpce.amazonaws.com:5432
        database: AirflowMetadata
  sourceConfig:
    config:
      type: PipelineMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    enableVersionValidation: false
    hostPort: https://sandbox.open-metadata.org/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: ...
"""


with DAG(
    dag_id="ecs_fargate_dag_vpc",
    schedule_interval=None,
    catchup=False,
    start_date=days_ago(1),
    is_paused_upon_creation=True,
) as dag:
    client=boto3.client('ecs')
    services=client.list_services(cluster=CLUSTER_NAME,launchType=LAUNCH_TYPE)
    service=client.describe_services(cluster=CLUSTER_NAME,services=services['serviceArns'])
    ecs_operator_task = ECSOperator(
        task_id = "ecs_ingestion_task",
        dag=dag,
        cluster=CLUSTER_NAME,
        task_definition=service['services'][0]['taskDefinition'],
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

        network_configuration=service['services'][0]['networkConfiguration'],
        awslogs_group=f"/ecs/{LOG_GROUP}",
        awslogs_stream_prefix=f"ecs/{CONTAINER_NAME}",
    )
```
