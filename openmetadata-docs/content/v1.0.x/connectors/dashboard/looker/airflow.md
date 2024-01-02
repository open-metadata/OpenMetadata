---
title: Run Looker Connector using Airflow SDK
slug: /connectors/dashboard/looker/airflow
---

# Run Looker using the Airflow SDK

| Stage      | PROD                         |
|------------|------------------------------|
| Dashboards | {% icon iconName="check" /%} |
| Charts     | {% icon iconName="check" /%} |
| Owners     | {% icon iconName="check" /%} |
| Tags       | {% icon iconName="cross" /%} |
| Datamodels | {% icon iconName="check" /%} |
| Lineage    | {% icon iconName="check" /%} |

In this section, we provide guides and references to use the Looker connector.

Configure and schedule Looker metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

There are two types of metadata we ingest from Looker:
- Dashboards & Charts
- LookML Models

In terms of permissions, we need a user with access to the Dashboards and LookML Explores that we want to ingest. You can
create your API credentials following these [docs](https://cloud.google.com/looker/docs/api-auth).

However, LookML Views are not present in the Looker SDK. Instead, we need to extract that information directly from
the GitHub repository holding the source `.lkml` files. In order to get this metadata, we will require a GitHub token
with read only access to the repository. You can follow these steps from the GitHub [documentation](https://docs.github.com/en/enterprise-server@3.4/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token).

{% note %}

The GitHub credentials are completely optional. Just note that without them, we won't be able to ingest metadata
out of LookML Views, including their lineage to the source databases.

{% /note %}

### Python Requirements

To run the Looker ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[looker]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/lookerConnection.json)
you can find the structure to create a connection to Looker.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Looker:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**clientId**: Specify the Client ID to connect to Looker. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**clientSecret**: Client Secret to connect to Looker.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: URL to the Looker instance.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**githubCredentials** (Optional): GitHub API credentials to extract LookML Views' information by parsing the source `.lkml` files. There are three
properties we need to add in this case:

- **repositoryOwner**: The owner (user or organization) of a GitHub repository. For example, in https://github.com/open-metadata/OpenMetadata, the owner is `open-metadata`.
- **repositoryName**: The name of a GitHub repository. For example, in https://github.com/open-metadata/OpenMetadata, the name is `OpenMetadata`.
- **token**: Token to use the API. This is required for private repositories and to ensure we don't hit API limits.

Follow these [steps](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-fine-grained-personal-access-token) in order to create a fine-grained personal access token.

When configuring, give repository access to `Only select repositories` and choose the one containing your LookML files. Then, we only need `Repository Permissions` as `Read-only` for `Contents`.


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
  type: looker
  serviceName: local_looker
  serviceConnection:
    config:
      type: Looker
```
```yaml {% srNumber=1 %}
      clientId: Client ID
```
```yaml {% srNumber=2 %}
      clientSecret: Client Secret
```
```yaml {% srNumber=3 %}
      hostPort: http://hostPort
```
```yaml {% srNumber=4 %}
      githubCredentials:
        repositoryOwner: open-metadata
        repositoryName: OpenMetadata
        token: XYZ
```
```yaml {% srNumber=5 %}
  sourceConfig:
    config:
      type: DashboardMetadata
      overrideOwner: True
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

```
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
