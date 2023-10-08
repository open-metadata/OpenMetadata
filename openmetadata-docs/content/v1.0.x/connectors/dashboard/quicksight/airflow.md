---
title: Run QuickSight Connector using Airflow SDK
slug: /connectors/dashboard/quicksight/airflow
---

# Run QuickSight using the Airflow SDK

| Stage      | PROD                         |
|------------|------------------------------|
| Dashboards | {% icon iconName="check" /%} |
| Charts     | {% icon iconName="check" /%} |
| Owners     | {% icon iconName="cross" /%} |
| Tags       | {% icon iconName="cross" /%} |
| Datamodels | {% icon iconName="cross" /%} |
| Lineage    | {% icon iconName="check" /%} |

In this section, we provide guides and references to use the QuickSight connector.

Configure and schedule QuickSight metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

AWS QuickSight Permissions
To execute metadata extraction and usage workflow successfully the IAM User should have enough access to fetch required data. Following table describes the minimum required permissions

| # | AWS QuickSight Permission |
| :---------- | :---------- |
| 1 | DescribeDashboard |
| 2 | ListAnalyses |
| 3 | ListDataSources |
| 4 | ListDashboards |
| 5 | DescribeAnalysis |
| 6 | DescribeDataSet |
| 7 | ListDataSets |
| 8 | DescribeDataSource |

Here is how to add Permissions to an IAM user.

- Navigate to the IAM console in the AWS Management Console.

- Choose the IAM user or group to which you want to attach the policy, and click on the "Permissions" tab.

- Click on the "Add permissions" button and select "Attach existing policies directly".

- Search for the policy by name or by filtering the available policies, and select the one you want to attach.

- Review the policy and click on "Add permissions" to complete the process.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "quicksight:DescribeDashboard",
                "quicksight:ListAnalyses",
                "quicksight:ListDataSources",
                "quicksight:ListDashboards",
                "quicksight:DescribeAnalysis",
                "quicksight:DescribeDataSet",
                "quicksight:ListDataSets",
                "quicksight:DescribeDataSource"
            ],
            "Resource": "*"
        }
    ]
}
```


To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

### Python Requirements

To run the QuickSight ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[QuickSight]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/quickSightConnection.json)
you can find the structure to create a connection to QuickSight.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is QuickSightled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for QuickSight:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**awsConfig**
  - **AWS Access Key ID**: Enter your secure access key ID for your Glue connection. The specified key ID should be authorized to read all databases you want to include in the metadata ingestion workflow.
  - **AWS Secret Access Key**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
  - **AWS Region**: Enter the location of the amazon cluster that your data and account are associated with.
  - **AWS Session Token (optional)**: The AWS session token is an optional parameter. If you want, enter the details of your temporary session token.
  - **Endpoint URL (optional)**: Your Glue connector will automatically determine the AWS QuickSight endpoint URL based on the region. You may override this behavior by entering a value to the endpoint URL.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**awsAccountId**: AWS Account ID

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**identityType**: The authentication method that the user uses to sign in.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**namespace**: The Amazon QuickSight namespace that contains the dashboard IDs in this request ( To be provided when identityType is `ANONYMOUS` )

{% /codeInfo %}

#### Source Configuration - Source Config

{% codeInfo srNumber=5 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/dashboardServiceMetadataPipeline.json):

- **dbServiceNames**: Database Service Names for ingesting lineage if the source supports it.
- **dashboardFilterPattern**, **chartFilterPattern**, **dataModelFilterPattern**: Note that all of them support regex as include or exclude. E.g., "My dashboard, My dash.*, .*Dashboard".
- **includeOwners**: Set the 'Include Owners' toggle to control whether to include owners to the ingested entity if the owner email matches with a user stored in the OM server as part of metadata ingestion. If the ingested entity already exists and has an owner, the owner will not be overwritten.
- **includeTags**: Set the 'Include Tags' toggle to control whether to include tags in metadata ingestion.
- **includeDataModels**: Set the 'Include Data Models' toggle to control whether to include tags as part of metadata ingestion.
- **markDeletedDashboards**: Set the 'Mark Deleted Dashboards' toggle to flag dashboards as soft-deleted if they are not present anymore in the source system.

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=6 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

#### Workflow Configuration

{% codeInfo srNumber=7 %}

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: quicksight
  serviceName: local_quicksight
  serviceConnection:
    config:
      type: QuickSight
```
```yaml {% srNumber=1 %}
      awsConfig:
        awsAccessKeyId: KEY
        awsSecretAccessKey: SECRET
        awsRegion: us-east-2
        awsSessionToken: Token
```
```yaml {% srNumber=2 %}
      awsAccountId: <aws-account-id>
```
```yaml {% srNumber=3 %}
      identityType: IAM #QUICKSIGHT, ANONYMOUS
```
```yaml {% srNumber=4 %}
      namespace: #to be provided if identityType is Anonymous
```
```yaml {% srNumber=5 %}
  sourceConfig:
    config:
      type: DashboardMetadata
      markDeletedDashboards: True
      # dbServiceNames:
      #   - service1
      #   - service2
      # dashboardFilterPattern:
      #   includes:
      #     - dashboard1
      #     - dashboard2
      #   excludes:
      #     - dashboard3
      #     - dashboard4
      # chartFilterPattern:
      #   includes:
      #     - chart1
      #     - chart2
      #   excludes:
      #     - chart3
      #     - chart4

```yaml {% srNumber=6 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=7 %}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

{% /codeBlock %}

{% /codePreview %}

### Workflow Configs for Security Provider

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/security/client).

## Openmetadata JWT Auth

- JWT tokens will allow your clients to authenticate against the OpenMetadata server. To enable JWT Tokens, you will get more details [here](/deployment/security/enable-jwt-tokens).

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

- You can refer to the JWT Troubleshooting section [link](/deployment/security/jwt-troubleshooting) for any issues in your JWT configuration. If you need information on configuring the ingestion with other security providers in your bots, you can follow this doc [link](/deployment/security/workflow-config-auth).

### 2. Prepare the Ingestion DAG

Create a Python file in your Airflow DAGs directory with the following contents:

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=8 %}

#### Import necessary modules

The `Workflow` class that is being imported is a part of a metadata ingestion framework, which defines a process of getting data from different sources and ingesting it into a central metadata repository.

Here we are also importing all the basic requirements to parse YAMLs, handle dates and build our DAG.

{% /codeInfo %}

{% codeInfo srNumber=9 %}

**Default arguments for all tasks in the Airflow DAG.** 

- Default arguments dictionary contains default arguments for tasks in the DAG, including the owner's name, email address, number of retries, retry delay, and execution timeout.

{% /codeInfo %}

{% codeInfo srNumber=10 %}

- **config**: Specifies config for the metadata ingestion as we prepare above.

{% /codeInfo %}

{% codeInfo srNumber=11 %}

- **metadata_ingestion_workflow()**: This code defines a function `metadata_ingestion_workflow()` that loads a YAML configuration, creates a `Workflow` object, executes the workflow, checks its status, prints the status to the console, and stops the workflow.

{% /codeInfo %}

{% codeInfo srNumber=12 %}

- **DAG**: creates a DAG using the Airflow framework, and tune the DAG configurations to whatever fits with your requirements
- For more Airflow DAGs creation details visit [here](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html#declaring-a-dag).

{% /codeInfo %}

Note that from connector to connector, this recipe will always be the same.
By updating the `YAML configuration`, you will be able to extract metadata from different sources.

{% /codeInfoContainer %}

{% codeBlock fileName="filename.py" %}

```python {% srNumber=8 %}
import pathlib
import yaml
from datetime import timedelta
from airflow import DAG
from metadata.config.common import load_config_file
from metadata.ingestion.api.workflow import Workflow
from airflow.utils.dates import days_ago

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

```

```python {% srNumber=9 %}
default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=60)
}

```

```python {% srNumber=10 %}
config = """
<your YAML configuration>
"""

```

```python {% srNumber=11 %}
def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = Workflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()

```

```python {% srNumber=12 %}
with DAG(
    "sample_data",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    schedule_interval='*/5 * * * *',
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )

```

{% /codeBlock %}

{% /codePreview %}

