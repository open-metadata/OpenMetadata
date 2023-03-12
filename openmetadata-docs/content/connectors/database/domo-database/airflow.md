---
title: Run DomoDatabase Connector using Airflow SDK
slug: /connectors/database/domo-database/airflow
---

# Run Domo Database using Airflow SDK 
<Table>

| Stage | Metadata |Query Usage | Data Profiler | Data Quality | Lineage | DBT | Supported Versions |
|:------:|:------:|:------:|:-----------:|:-------------:|:------------:|:-------:|:---:|:------------------:|
|  PROD  |   ✅   |      ❌      |       ❌       |       ❌      |    ❌    |  ❌  |  --  |

</Table>

<Table>

| Lineage | Table-level | Column-level |
|:------:|:-----------:|:-------------:|
| ❌ | ❌ | ❌ |

</Table>

In this section, we provide guides and references to use the Domo Database connector

Configure and schedule DomoDatabase metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [dbt Integration](#dbt-integration)

## Requirements

<InlineCallout color="violet-70" icon="description" bold="OpenMetadata 0.12 or later" href="/deployment">
To deploy OpenMetadata, check the <a href="/deployment">Deployment</a> guides.
</InlineCallout>

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

<Note>

For metadata ingestion, kindly make sure add alteast `data` scopes to the clientId provided.
Question related to scopes, click [here](https://developer.domo.com/docs/authentication/quickstart-5).

</Note>

### Python Requirements

To run the DomoDatabase ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[domo]"
```
## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/verticaConnection.json)
you can find the structure to create a connection to Vertica.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for DomoDatabase:    

```yaml
source:
  type: domodatabase
  serviceName: local_DomoDatabase
  serviceConnection:
    config:
      type: DomoDashboard
      clientId: client-id
      secretToken: secret-token
      accessToken: access-token
      apiHost: api.domo.com
      sandboxDomain: https://<api_domo>.domo.com
      
      # database: database
  sourceConfig:
    config:
      type: DatabaseMetadata
      markDeletedTables: true
      includeTables: true
      includeViews: true
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  # loggerLevel: DEBUG  # DEBUG, INFO, WARN or ERROR
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>2. Configure service settings
```

#### Source Configuration - Service Connection

- **Client ID**: Client ID to Connect to DOMODatabase.
- **Secret Token**: Secret Token to Connect DOMODatabase.
- **Access Token**: Access to Connect to DOMODatabase.
- **API Host**:  API Host to Connect to DOMODatabase instance.
- **SandBox Domain**: Connect to SandBox Domain.


#### Source Configuration - Source Config

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json):

- `markDeletedTables`: To flag tables as soft-deleted if they are not present anymore in the source system.
- `includeTables`: true or false, to ingest table data. Default is true.
- `includeViews`: true or false, to ingest views definitions.
- `databaseFilterPattern`, `schemaFilterPattern`, `tableFilternPattern`: Note that the they support regex as include or exclude. E.g.,

```yaml
tableFilterPattern:
  includes:
    - users
    - type_test
```

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: openmetadata
    securityConfig:
      jwtToken: '{bot_jwt_token}'
```

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/security/client).
You can find the different implementation of the ingestion below.

<Collapse title="Configure SSO in the Ingestion Workflows">

### Openmetadata JWT Auth

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: openmetadata
    securityConfig:
      jwtToken: '{bot_jwt_token}'
```
### Auth0 SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: auth0
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

### Azure SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: azure
    securityConfig:
      clientSecret: '{your_client_secret}'
      authority: '{your_authority_url}'
      clientId: '{your_client_id}'
      scopes:
        - your_scopes
```

### Custom OIDC SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: custom-oidc
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```
### Google SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: google
    securityConfig:
      secretKey: '{path-to-json-creds}'
```

### Okta SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: okta
    securityConfig:
      clientId: "{CLIENT_ID - SPA APP}"
      orgURL: "{ISSUER_URL}/v1/token"
      privateKey: "{public/private keypair}"
      email: "{email}"
      scopes:
        - token
```

### Amazon Cognito SSO

The ingestion can be configured by [Enabling JWT Tokens](https://docs.open-metadata.org/deployment/security/enable-jwt-tokens)

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: auth0
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

### OneLogin SSO

Which uses Custom OIDC for the ingestion

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: custom-oidc
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

### KeyCloak SSO

Which uses Custom OIDC for the ingestion

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: custom-oidc
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

</Collapse>

### 2. Prepare the Ingestion DAG

Create a Python file in your Airflow DAGs directory with the following contents:

```python
import pathlib
import yaml
from datetime import timedelta
from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.config.common import load_config_file
from metadata.ingestion.api.workflow import Workflow
from airflow.utils.dates import days_ago

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=60)
}

config = """
<your YAML configuration>
"""

def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = Workflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()

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
Note that from connector to connector, this recipe will always be the same. 
By updating the YAML configuration, you will be able to extract metadata from different sources.

### 1. Define the YAML Config

This is a sample config for the profiler:

```yaml
source:
  type: domodatabase
  serviceName: <service name>
  serviceConnection:
    config:
      type: DomoDatabase
      clientId: clientid
      secretToken: secret Token
      accessToken: access Token
      apiHost: api.domo.com
      sandboxDomain: https://<api_domo>.domo.com
  sourceConfig:
    config:
      type: DatabaseMetadata
     
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  # loggerLevel: DEBUG  # DEBUG, INFO, WARN or ERROR
  openMetadataServerConfig:
    hostPort:  http://localhost:8585/api
    authProvider: <OpenMetadata auth provider>
    ```

#### Source Configuration

- You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/athenaConnection.json).
- The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceProfilerPipeline.json).

Note that the filter patterns support regex as includes or excludes. E.g.,

```yaml
tableFilterPattern:
  includes:
  - *users$
```
#### Workflow Configuration

The same as the metadata ingestion.

### 2. Prepare the Profiler DAG

Here, we follow a similar approach as with the metadata and usage pipelines, although we will use a different Workflow class:

```python
import yaml
from datetime import timedelta

from airflow import DAG

try:
   from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
   from airflow.operators.python_operator import PythonOperator

from airflow.utils.dates import days_ago

from metadata.profiler.api.workflow import ProfilerWorkflow


default_args = {
   "owner": "user_name",
   "email_on_failure": False,
   "retries": 3,
   "retry_delay": timedelta(seconds=10),
   "execution_timeout": timedelta(minutes=60),
}

config = """
<your YAML configuration>
"""

def metadata_ingestion_workflow():
   workflow_config = yaml.safe_load(config)
   workflow = ProfilerWorkflow.create(workflow_config)
   workflow.execute()
   workflow.raise_from_status()
   workflow.print_status()
   workflow.stop()

with DAG(
   "profiler_example",
   default_args=default_args,
   description="An example DAG which runs a OpenMetadata ingestion workflow",
   start_date=days_ago(1),
   is_paused_upon_creation=False,
   catchup=False,
) as dag:
   ingest_task = PythonOperator(
       task_id="profile_and_test_using_recipe",
       python_callable=metadata_ingestion_workflow,
   )
```
