---
title: Managing Credentials
slug: /deployment/ingestion/external/credentials
---

# Managing Credentials

On the release 0.12 we updated how services credentials are handled from an Ingestion Workflow. We are covering
now two scenarios:

**1.** If we are running a metadata workflow for the first time, pointing to a service that **does not yet exist**,
    then the service will be created from the Metadata Ingestion pipeline. It does not matter if the workflow
    is run from the CLI or any other scheduler.

**2.** If instead, there is an already existing service to which we are pointing with a Metadata Ingestion pipeline,
    then we will be using the **stored credentials**, not the ones incoming from the YAML config.

## Existing Services

What this means is that once a service is created, the only way to update its connection credentials is via
the **UI** or directly running an API call. This prevents the scenario where a new YAML config is created, using a name
of a service that already exists, but pointing to a completely different source system.

One of the main benefits of this approach is that if an admin in our organisation creates the service from the UI,
then we can prepare any Ingestion Workflow without having to pass the connection details.

For example, for an Athena YAML, instead of requiring the full set of credentials as below:

```yaml
source:
  type: athena
  serviceName: my_athena_service
  serviceConnection:
    config:
      type: Athena
      awsConfig:
        awsAccessKeyId: KEY
        awsSecretAccessKey: SECRET
        awsRegion: us-east-2
      s3StagingDir: s3 directory for datasource
      workgroup: workgroup name
  sourceConfig:
    type: DatabaseMetadata
    config:
      markDeletedTables: true
      includeTables: true
      includeViews: true
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

We can use a simplified version:

```yaml
source:
  type: athena
  serviceName: my_athena_service
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
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

The workflow will then dynamically pick up the service connection details for `my_athena_service` and ingest
the metadata accordingly.

If instead, you want to have the full source of truth in your DAGs or processes, you can keep reading on different
ways to secure the credentials in your environment and not have them at plain sight.

## Securing Credentials

{% note %}

Note that these are just a few examples. Any secure and automated approach to retrieve a string would work here,
as our only requirement is to pass the string inside the YAML configuration.

{% /note %}

When running Workflow with the CLI or your favourite scheduler, it's safer to not have the services' credentials
visible. For the CLI, the ingestion package can load sensitive information from environment variables.

For example, if you are using the [Glue](/connectors/database/glue) connector you could specify the
AWS configurations as follows in the case of a JSON config file

```json
[...]
"awsConfig": {
    "awsAccessKeyId": "${AWS_ACCESS_KEY_ID}",
    "awsSecretAccessKey": "${AWS_SECRET_ACCESS_KEY}",
    "awsRegion": "${AWS_REGION}",
    "awsSessionToken": "${AWS_SESSION_TOKEN}"
},
[...]
```

Or

```yaml
[...]
awsConfig:
  awsAccessKeyId: '${AWS_ACCESS_KEY_ID}'
  awsSecretAccessKey: '${AWS_SECRET_ACCESS_KEY}'
  awsRegion: '${AWS_REGION}'
  awsSessionToken: '${AWS_SESSION_TOKEN}'
[...]
```

for a YAML configuration.

### AWS Credentials

The AWS Credentials are based on the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/security/credentials/awsCredentials.json).
Note that the only required field is the `awsRegion`. This configuration is rather flexible to allow installations under AWS
that directly use instance roles for permissions to authenticate to whatever service we are pointing to without having to
write the credentials down.

#### AWS Vault

If using [aws-vault](https://github.com/99designs/aws-vault), it gets a bit more involved to run the CLI ingestion as the credentials are not globally available in the terminal.
In that case, you could use the following command after setting up the ingestion configuration file:

```bash
aws-vault exec <role> -- $SHELL -c 'metadata ingest -c <path to connector>'
```

### GCP Credentials

The GCP Credentials are based on the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/security/credentials/gcpCredentials.json).
These are the fields that you can export when preparing a Service Account.

Once the account is created, you can see the fields in the exported JSON file from:

```
IAM & Admin > Service Accounts > Keys
```

You can validate the whole Google service account setup [here](/deployment/security/google).

### Using GitHub Actions Secrets

If running the ingestion in a GitHub Action, you can create [encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
to store sensitive information such as users and passwords.

In the end, we'll map these secrets to environment variables in the process, that we can pick up with `os.getenv`, for example:

```python
import os
import yaml

from metadata.workflow.metadata import MetadataWorkflow

from metadata.workflow.workflow_output_handler import print_status

CONFIG = f"""
source:
  type: snowflake
  serviceName: snowflake_from_github_actions
  serviceConnection:
    config:
      type: Snowflake
      username: {os.getenv('SNOWFLAKE_USERNAME')}
...
"""


def run():
    workflow_config = yaml.safe_load(CONFIG)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    print_status(workflow)
    workflow.stop()


if __name__ == "__main__":
    run()
```

Make sure to update your step environment to pass the secrets as environment variables:

```yaml
- name: Run Ingestion
  run: |
    source env/bin/activate
    python ingestion-github-actions/snowflake_ingestion.py
  # Add the env vars we need to load the snowflake credentials
  env:
     SNOWFLAKE_USERNAME: ${{ secrets.SNOWFLAKE_USERNAME }}
     SNOWFLAKE_PASSWORD: ${{ secrets.SNOWFLAKE_PASSWORD }}
     SNOWFLAKE_WAREHOUSE: ${{ secrets.SNOWFLAKE_WAREHOUSE }}
     SNOWFLAKE_ACCOUNT: ${{ secrets.SNOWFLAKE_ACCOUNT }}
```

You can see a full demo setup [here](https://github.com/open-metadata/openmetadata-demo/tree/main/ingestion-github-actions).

### Using Airflow Connections

In any connector page, you might have seen an example on how to build a DAG to run the ingestion with Airflow
(e.g., [Athena](https://docs.open-metadata.org/connectors/database/athena/airflow#2-prepare-the-ingestion-dag)).

A possible approach to retrieving sensitive information from Airflow would be using Airflow's 
[Connections](https://airflow.apache.org/docs/apache-airflow/stable/howto/connection.html). Note that these
connections can be stored as environment variables, to Airflow's underlying DB or to multiple external services such as
Hashicorp Vault. Note that for external systems, you'll need to provide the necessary package and configure the 
[Secrets Backend](https://airflow.apache.org/docs/apache-airflow/stable/security/secrets/secrets-backend/index.html).
The best way to choose how to store these credentials is to go through Airflow's [docs](https://airflow.apache.org/docs/apache-airflow/stable/concepts/connections.html).

#### Example

Let's go over an example on how to create a connection to extract data from MySQL and how a DAG would look like
afterwards.

#### Step 1 - Create the Connection

From our Airflow host, (e.g., `docker exec -it openmetadata_ingestion bash` if testing in Docker), you can run:

```bash
airflow connections add 'my_mysql_db' \
    --conn-uri 'mysql+pymysql://openmetadata_user:openmetadata_password@mysql:3306/openmetadata_db'
```

You will see an output like

```
Successfully added `conn_id`=my_mysql_db : mysql+pymysql://openmetadata_user:openmetadata_password@mysql:3306/openmetadata_db
```

Checking the credentials from the Airflow UI, we will see:


{% image
  src="/images/v1.3/connectors/credentials/airflow-connection.png"
  alt="Airflow Connection" /%}

#### Step 2 - Understanding the shape of a Connection

In the same host, we can open a Python shell to explore the Connection object with some more details. To do so, we first
need to pick up the connection from Airflow. We will use the `BaseHook` for that as the connection is not stored
in any external system.

```python
from airflow.hooks.base import BaseHook

# Retrieve the connection
connection = BaseHook.get_connection("my_mysql_db")

# Access the connection details
connection.host  # 'mysql'
connection.port  # 3306
connection.login  # 'openmetadata_user'
connection.password  # 'openmetadata_password'
```

Based on this information, we now know how to prepare the DAG!

#### Step 3 - Write the DAG

A full example on how to write a DAG to ingest data from our Connection can look like this:

```python
import pathlib
import yaml
from datetime import timedelta
from airflow import DAG
from airflow.utils.dates import days_ago

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.config.common import load_config_file
from metadata.workflow.metadata import MetadataWorkflow

from metadata.workflow.workflow_output_handler import print_status

# Import the hook
from airflow.hooks.base import BaseHook

# Retrieve the connection
connection = BaseHook.get_connection("my_mysql_db")

# Use the connection details when setting the YAML
# Note how we escaped the braces as {{}} to not be parsed by the f-string
config = f"""
source:
  type: mysql
  serviceName: mysql_from_connection
  serviceConnection:
    config:
      type: Mysql
      username: {connection.login}
      password: {connection.password}
      hostPort: {connection.host}:{connection.port}
      # databaseSchema: schema
  sourceConfig:
    config:
      markDeletedTables: true
      includeTables: true
      includeViews: true
sink:
  type: metadata-rest
  config: {{}}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "<OpenMetadata host and port>"
    authProvider: "<OpenMetadata auth provider>"
"""

def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    print_status(workflow)
    workflow.stop()

with DAG(
    "mysql_connection_ingestion",
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

#### Option B - Reuse an existing Service

Following the explanation at the beginning of this doc, we can reuse the credentials from an existing service
in a DAG as well, and just omit the `serviceConnection` YAML entries:

```python
import pathlib
import yaml
from datetime import timedelta
from airflow import DAG
from airflow.utils.dates import days_ago

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.config.common import load_config_file
from metadata.workflow.metadata import MetadataWorkflow

from metadata.workflow.workflow_output_handler import print_status

config = """
source:
  type: mysql
  serviceName: existing_mysql_service
  sourceConfig:
    config:
      markDeletedTables: true
      includeTables: true
      includeViews: true
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "<OpenMetadata host and port>"
    authProvider: "<OpenMetadata auth provider>"
"""

def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    print_status(workflow)
    workflow.stop()

with DAG(
    "mysql_connection_ingestion",
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
