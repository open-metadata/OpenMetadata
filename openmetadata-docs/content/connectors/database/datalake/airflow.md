---
title: Run Datalake Connector using Airflow SDK
slug: /connectors/database/datalake/airflow
---

# Run Datalake using the Airflow SDK

In this section, we provide guides and references to use the Datalake connector.

Configure and schedule Datalake metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [dbt Integration](#dbt-integration)

## Requirements

<InlineCallout color="violet-70" icon="description" bold="OpenMetadata 0.12 or later" href="/deployment">
To deploy OpenMetadata, check the <a href="/deployment">Deployment</a> guides.
</InlineCallout>

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

<Note>

Datalake connector supports extracting metadata from file types `JSON`, `CSV`, `TSV` & `Parquet`.

</Note>

** S3 Permissions **

<p> To execute metadata extraction AWS account should have enough access to fetch required data. The <strong>Bucket Policy</strong> in AWS requires at least these permissions: </p>

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::<my bucket>",
                "arn:aws:s3:::<my bucket>/*"
            ]
        }
    ]
}
```

### Python Requirements

If running OpenMetadata version greater than 0.13, you will need to install the Datalake ingestion for GCS or S3:

#### S3 installation

```bash
pip3 install "openmetadata-ingestion[datalake-s3]"
```

#### GCS installation

```bash
pip3 install "openmetadata-ingestion[datalake-gcs]"
```

#### Azure installation

```bash
pip3 install "openmetadata-ingestion[datalake-azure]"
```

#### If version <0.13

You will be installing the requirements together for S3 and GCS

```bash
pip3 install "openmetadata-ingestion[datalake]"
```

## Metadata Ingestion
All connectors are defined as JSON Schemas. Here you can find the structure to create a connection to Datalake.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a YAML configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following JSON Schema.

## 1. Define the YAML Config
This is a sample config for Datalake using AWS S3:

```yaml

source:
  type: datalake
  serviceName: local_datalake
  serviceConnection:
    config:
      type: Datalake
      configSource:      
        securityConfig: 
          awsAccessKeyId: aws access key id
          awsSecretAccessKey: aws secret access key
          awsRegion: aws region
      bucketName: bucket name
      prefix: prefix
  sourceConfig:
    config:
      type: DatabaseMetadata
      tableFilterPattern:
        includes:
        - ''
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  # loggerLevel: DEBUG  # DEBUG, INFO, WARN or ERROR
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    hostPort: "<OpenMetadata host and port>"
    authProvider: "<OpenMetadata auth provider>"

```

#### Source Configuration - Source Config using AWS S3

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json).

* **awsAccessKeyId**: Enter your secure access key ID for your DynamoDB connection. The specified key ID should be authorized to read all databases you want to include in the metadata ingestion workflow.
* **awsSecretAccessKey**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
* **awsRegion**: Specify the region in which your DynamoDB is located. This setting is required even if you have configured a local AWS profile.
* **schemaFilterPattern** and **tableFilternPattern**: Note that the `schemaFilterPattern` and `tableFilterPattern` both support regex as `include` or `exclude`. E.g.,

This is a sample config for Datalake using GCS:

```yaml
source:
  type: datalake
  serviceName: local_datalake
  serviceConnection:
    config:
      type: Datalake
      configSource:
        securityConfig:
          gcsConfig:
            type: type of account
            projectId: project id
            privateKeyId: private key id
            privateKey: private key
            clientEmail: client email
            clientId: client id
            authUri: https://accounts.google.com/o/oauth2/auth
            tokenUri: https://oauth2.googleapis.com/token
            authProviderX509CertUrl: https://www.googleapis.com/oauth2/v1/certs
            clientX509CertUrl:  clientX509 Certificate Url
      bucketName: bucket name
      prefix: prefix
  sourceConfig:
    config:
      tableFilterPattern:
        includes:
          - ''
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  # loggerLevel: DEBUG  # DEBUG, INFO, WARN or ERROR
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    hostPort: "<OpenMetadata host and port>"
    authProvider: "<OpenMetadata auth provider>"
```

- `markDeletedTables`: To flag tables as soft-deleted if they are not present anymore in the source system.
- `includeTables`: true or false, to ingest table data. Default is true.
- `includeViews`: true or false, to ingest views definitions.
- `databaseFilterPattern`, `schemaFilterPattern`, `tableFilternPattern`: Note that the they support regex as include or exclude. E.g.,


#### Source Configuration - Service Connection using GCS

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json).

* **type**: Credentials type, e.g. `service_account`.
* **projectId**
* **privateKey**
* **privateKeyId**
* **clientEmail**
* **clientId**
* **authUri**: [https://accounts.google.com/o/oauth2/auth](https://accounts.google.com/o/oauth2/auth) by default
* **tokenUri**: [https://oauth2.googleapis.com/token](https://oauth2.googleapis.com/token) by default
* **authProviderX509CertUrl**: [https://www.googleapis.com/oauth2/v1/certs](https://www.googleapis.com/oauth2/v1/certs) by default
* **clientX509CertUrl**
* **bucketName**: name of the bucket in GCS
* **Prefix**: prefix in gcs bucket
* **schemaFilterPattern** and **tableFilternPattern**: Note that the `schemaFilterPattern` and `tableFilterPattern` both support regex as `include` or `exclude`. E.g.,

#### Source Configuration - Source Config

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json):

- `markDeletedTables`: To flag tables as soft-deleted if they are not present anymore in the source system.
- `includeTables`: true or false, to ingest table data. Default is true.
- `includeViews`: true or false, to ingest views definitions.
- `databaseFilterPattern`, `schemaFilterPattern`, `tableFilternPattern`: Note that the they support regex as include or exclude. E.g.,

This is a sample config for Datalake using Azure:

```yaml
# Datalake with Azure 

source:
  type: datalake
  serviceName: local_datalake
  serviceConnection:
    config:
      type: Datalake
      configSource:      
        securityConfig: 
          clientId: client-id
          clientSecret: client-secret
          tenantId: tenant-id
          accountName: account-name
      prefix: prefix
  sourceConfig:
    config:
      tableFilterPattern:
        includes:
        - ''
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

#### Source Configuration - Service Connection using Azure

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/security/credentials/azureCredentials.json).

- **Client ID** : Client ID of the data storage account
- **Client Secret** : Client Secret of the account
- **Tenant ID** : Tenant ID under which the data storage account falls
- **Account Name** : Account Name of the data Storage

**schemaFilterPattern** and **tableFilternPattern**: Note that the `schemaFilterPattern` can be used to filter `container` and `tableFilterPattern` can be used to filter `files` and both support regex as `include` or `exclude`. E.g.,

```yaml
schemaFilterPattern:
 includes:
  - container1
  excludes:
  - container2
tableFilterPattern:
  includes:
    - *json
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

## dbt Integration

You can learn more about how to ingest dbt models' definitions and their lineage [here](/connectors/ingestion/workflows/dbt).
