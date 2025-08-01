---
title: Hybrid SaaS | Secure Metadata Ingestion for Collate
slug: /getting-started/day-1/hybrid-saas
collate: true
---

# Hybrid SaaS

{%  youtube url="https://drive.google.com/file/d/16-2l9EYBE9DjlHepPKTpVFvashMy1buu/preview" start="0:00" end="6:47" width="800px" height="450px" /%}

There's two options on how to set up a data connector:
1. **Run the connector in Collate SaaS**: In this scenario, you'll get an IP when you add the service. You need to give
   access to this IP in your data sources.
2. **Run the connector in your infrastructure or laptop**: In this case, Collate won't be accessing the data, but rather
   you'd control where and how the process is executed and Collate will only receive the output of the metadata extraction.
   This is an interesting option for sources lying behind private networks or when external SaaS services are not allowed to
   connect to your data sources.

Any tool capable of running Python code can be used to configure the metadata extraction from your sources.

{% partial file="/v1.7/connectors/python-requirements.md" /%}

In this section we'll show you how the ingestion process works and how to test it from your laptop.

## Collate Ingestion Agent  

The Collate Ingestion Agent is designed to facilitate metadata ingestion for hybrid deployments, allowing organizations to securely push metadata from their infrastructure into the Collate platform without exposing their internal systems. It provides a secure and efficient channel for running ingestion workflows while maintaining full control over data processing within your network. This document outlines the setup and usage of the Collate Ingestion Agent, emphasizing its role in hybrid environments and key functionalities.

### Overview  

The Collate Ingestion Agent is ideal for scenarios where running connectors on-premises is necessary, providing a secure and efficient way to process metadata within your infrastructure. This eliminates concerns about data privacy and streamlines the ingestion process.

With the Collate Ingestion Agent, you can:  
- Set up ingestion workflows easily without configuring YAML files manually.  
- Leverage the Collate UI for a seamless and user-friendly experience.  
- Manage various ingestion types, including metadata, profiling, lineage, usage, DBT, and data quality.

### Setting Up the Collate Ingestion Agent  

#### 1. Prepare Your Environment  
To begin, download the Collate-provided Docker image for the Ingestion Agent. The Collate team will provide the necessary credentials to authenticate and pull the image from the repository.  

**Run the following commands:**  
- **Log in to Docker**: Use the credentials provided by Collate to authenticate.  
- **Pull the Docker Image**: Run the command to pull the image into your local environment.  

Once the image is downloaded, you can start the Docker container to initialize the Ingestion Agent.  

#### 2. Configure the Agent  

#### Access the Local Agent UI:  
- Open your browser and navigate to the local instance of the Collate Ingestion Agent.  

#### Set Up the Connection:  
- Enter your Collate platform URL (e.g., `https://<your-company>.collate.com/api`).  
- Add the ingestion bot token from the Collate settings under **Settings > Bots > Ingestion Bot**.  

#### Verify Services:  
- Open the Collate UI and confirm that all available services (e.g., databases) are visible in the Ingestion Agent interface.  

#### 3. Add a New Service  

1. Navigate to the **Database Services** section in the Ingestion Agent UI.  
2. Click **Add New Service** and select the database type (e.g., Redshift).  
3. Enter the necessary service configuration:  
   - **Service Name**: A unique name for the database service.  
   - **Host and Port**: Connection details for the database.  
   - **Username and Password**: Credentials to access the database.  
   - **Database Name**: The target database for ingestion.  
4. Test the connection to ensure the service is properly configured.

#### 4. Run Metadata Ingestion  

1. After creating the service, navigate to the **Ingestion** tab and click **Add Ingestion**.  
2. Select the ingestion type (e.g., metadata) and specify any additional configurations:  
   - Include specific schemas or tables.  
   - Enable options like DDL inclusion if required.  
3. Choose whether to:  
   - Run the ingestion immediately via the agent.  
   - Download the YAML configuration file for running ingestion on an external scheduler.  
4. Monitor the logs in real-time to track the ingestion process.

#### 5. Verify Ingested Data  

1. Return to the Collate platform and refresh the database service.  
2. Verify that the ingested metadata, including schemas, tables, and column details, is available.  
3. Explore additional ingestion options like profiling, lineage, or data quality for the service.  

### Additional Features  

The Collate Ingestion Agent supports various ingestion workflows, allowing you to:  
- **Generate YAML Configurations**: Download YAML files for external scheduling.  
- **Manage Ingestion Types**: Run metadata, profiling, lineage, usage, and other workflows as needed.  
- **Monitor Progress**: View logs and monitor real-time ingestion activity.

## 1. How does the Ingestion Framework work?

The Ingestion Framework contains all the logic about how to connect to the sources, extract their metadata
and send it to the OpenMetadata server. We have built it from scratch with the main idea of making it an independent
component that can be run from - **literally** - anywhere.

In order to install it, you just need to get it from [PyPI](https://pypi.org/project/openmetadata-ingestion/).

```shell
pip install openmetadata-ingestion
```

We will show further examples later, but a piece of code is the best showcase for its simplicity. In order to run
a full ingestion process, you just need to execute a single function. For example, if we wanted to run the metadata
ingestion from within a simple Python script:

```python
from metadata.workflow.metadata import MetadataWorkflow
 

# Specify your YAML configuration
CONFIG = """
source:
  ...
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: openmetadata
    securityConfig:
      jwtToken: ...
"""

def run():
    workflow_config = yaml.safe_load(CONFIG)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


if __name__ == "__main__":
  run()
```

Where this function runs is completely up to you, and you can adapt it to what makes the most sense within your
organization and engineering context. Below you'll see some examples of different orchestrators you can leverage
to execute the ingestion process.

## 2. Ingestion Configuration

In the example above, the `Workflow` class got created from a YAML configuration. Any Workflow that you execute (ingestion,
profiler, lineage,...) will have its own YAML representation.

You can think about this configuration as the recipe you want to execute: where is your source, which pieces do you
extract, how are they processed and where are they sent.

An example YAML config for extracting MySQL metadata looks like this:

```yaml
source:
  type: mysql
  serviceName: mysql
  serviceConnection:
    config:
      type: Mysql
      username: openmetadata_user
      authType:
        password: openmetadata_password
      hostPort: localhost:3306
      databaseSchema: openmetadata_db
  sourceConfig:
    config:
      type: DatabaseMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: openmetadata
    securityConfig:
      jwtToken: ...
```

{% note %}
You will find examples of all the workflow's YAML files at each Connector [page](/connectors).
{% /note %}

We will now show you examples on how to configure and run every workflow externally by using Snowflake as an example. But
first, let's digest some information that will be common everywhere, the `workflowConfig`.

### Workflow Config

Here you will define information such as where are you hosting the OpenMetadata server, and the JWT token to authenticate.

{% note noteType="Warning" %}

Review this section carefully to ensure you are properly managing service credentials and other security configurations.

{% /note %}

**Logger Level**

You can specify the `loggerLevel` depending on your needs. If you are trying to troubleshoot an ingestion, running
with `DEBUG` will give you far more traces for identifying issues.

**JWT Token**

JWT tokens will allow your clients to authenticate against the OpenMetadata server.
To enable JWT Tokens, you will get more details [here](/deployment/security/enable-jwt-tokens).

You can refer to the JWT Troubleshooting section [link](/deployment/security/jwt-troubleshooting) for any issues in
your JWT configuration.

**Store Service Connection**

If set to `true` (default), we will store the sensitive information either encrypted via the Fernet Key in the database
or externally, if you have configured any [Secrets Manager](/deployment/secrets-manager).

If set to `false`, the service will be created, but the service connection information will only be used by the Ingestion
Framework at runtime, and won't be sent to the OpenMetadata server.

**Secrets Manager Configuration**

If you have configured any [Secrets Manager](/deployment/secrets-manager), you need to let the Ingestion Framework know
how to retrieve the credentials securely.

Follow the [docs](/deployment/secrets-manager) to configure the secret retrieval based on your environment.

**SSL Configuration**

If you have added SSL to the [OpenMetadata server](/deployment/security/enable-ssl), then you will need to handle
the certificates when running the ingestion too. You can either set `verifySSL` to `ignore`, or have it as `validate`,
which will require you to set the `sslConfig.caCertificate` with a local path where your ingestion runs that points
to the server certificate file.

Find more information on how to troubleshoot SSL issues [here](/deployment/security/enable-ssl/ssl-troubleshooting).

```yaml
workflowConfig:
  loggerLevel: INFO  # DEBUG, INFO, WARNING or ERROR
  openMetadataServerConfig:
    hostPort: "https://customer.getcollate.io/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
    ## Store the service Connection information
    storeServiceConnection: false
```

## 3. (Optional) Ingestion Pipeline

Additionally, if you want to see your runs logged in the `Ingestions` tab of the connectors page in the UI as you would
when running the connectors natively with OpenMetadata, you can add the following configuration on your YAMLs:

```yaml
source:
  type: mysql
  serviceName: mysql
[...]
workflowConfig:
  openMetadataServerConfig:
    hostPort: "https://customer.getcollate.io/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: ...
ingestionPipelineFQN: <serviceName>.<pipelineName>  # E.g., mysql.marketing_metadata`
```

Adding the `ingestionPipelineFQN` - the Ingestion Pipeline Fully Qualified Name - will tell the Ingestion Framework
to log the executions and update the ingestion status, which will appear on the UI. Note that the action buttons
will be disabled, since OpenMetadata won't be able to interact with external systems.

## 4. (Optional) Disable the Pipeline Service Client

If you want to run your workflows **ONLY externally** without relying on OpenMetadata for any workflow management
or scheduling, you can update the following server configuration:

```yaml
pipelineServiceClientConfiguration:
  enabled: ${PIPELINE_SERVICE_CLIENT_ENABLED:-true}
```

by setting `enabled: false` or setting the `PIPELINE_SERVICE_CLIENT_ENABLED=false` as an environment variable.

This will stop certain APIs and monitors related to the Pipeline Service Client (e.g., Airflow) from being operative.

## Examples

{% note %}

This is not an exhaustive list, and it will keep growing over time. Not because the orchestrators X or Y are not supported,
but just because we did not have the time yet to add it here. If you'd like to chip in and help us expand these guides and examples,
don't hesitate to reach to us in [Slack](https://slack.open-metadata.org/) or directly open a PR in
[GitHub](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-docs/content).

{% /note %}
{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="10k"
    bold="Airflow"
    href="/deployment/ingestion/external/airflow" %}
    Run the ingestion process externally from Airflow
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="10k"
    bold="MWAA"
    href="/deployment/ingestion/external/mwaa" %}
    Run the ingestion process externally using AWS MWAA
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="10k"
    bold="GCP Composer "
    href="/deployment/ingestion/external/gcs-composer" %}
    Run the ingestion process externally from GCP Composer 
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="10k"
    bold="GitHub Actions"
    href="/deployment/ingestion/external/github-actions" %}
    Run the ingestion process externally from GitHub Actions
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

Let's jump now into some examples on how you could create the function the run the different workflows. Note that this code
can then be executed inside a DAG, a GitHub action, or a vanilla Python script. It will work for any environment.

### Testing

You can easily test every YAML configuration using the `metadata` CLI from the Ingestion Framework.
In order to install it, you just need to get it from [PyPI](https://pypi.org/project/openmetadata-ingestion/).

In each of the examples below, we'll showcase how to run the CLI, assuming you have a YAML file that contains
the workflow configuration.

### Metadata Workflow

This is the first workflow you have to configure and run. It will take care of fetching the metadata from your sources,
be it Database Services, Dashboard Services, Pipelines, etc.

The rest of the workflows (Lineage, Profiler,...) will be executed on top of the metadata already available in the platform.

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=1 %}
**Adding the imports**

The first step is to import the `MetadataWorkflow` class, which will take care of the full ingestion logic. We'll
add the import for printing the results at the end.
{% /codeInfo %}

{% codeInfo srNumber=2 %}
**Defining the YAML**

Then, we need to pass the YAML configuration. For this simple example we are defining a variable, but you can
read from a file, parse secrets from your environment, or any other approach you'd need. In the end, it's just
Python code.

{% note %}
You can find complete YAMLs in each connector [docs](/connectors) and find more information about the available
configurations.
{% /note %}

{% /codeInfo %}

{% codeInfo srNumber=3 %}
**Preparing the Workflow**

Finally, we'll prepare a function that we can execute anywhere.

It will take care of instantiating the workflow, executing it and giving us the results.
{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="ingestion.py" %}

```python {% isCodeBlock=true %}
import yaml

```

```python  {% srNumber=1 %}
from metadata.workflow.metadata import MetadataWorkflow
 

```

```python {% srNumber=2 %}

CONFIG = """
source:
  type: snowflake
  serviceName: <service name>
  serviceConnection:
    config:
      type: Snowflake
      ...
  sourceConfig:
    config:
      type: DatabaseMetadata
      markDeletedTables: true
      includeTables: true
      ...
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
"""

```

```python {% srNumber=3 %}

def run():
    workflow = MetadataWorkflow.create(CONFIG)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()
```

{% /codeBlock %}

{% /codePreview %}

{% note %}

You can test the workflow via `metadata ingest -c <path-to-yaml>`.

{% /note %}


### Lineage Workflow

This workflow will take care of scanning your query history and defining lineage relationships between your tables.

You can find more information about this workflow [here](/connectors/ingestion/lineage).

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=1 %}
**Adding the imports**

The first step is to import the `MetadataWorkflow` class, which will take care of the full ingestion logic. We'll
add the import for printing the results at the end.

Note that we are using the same class as in the Metadata Ingestion.
{% /codeInfo %}

{% codeInfo srNumber=2 %}
**Defining the YAML**

Then, we need to pass the YAML configuration. For this simple example we are defining a variable, but you can
read from a file, parse secrets from your environment, or any other approach you'd need.

Note how we have not added here the `serviceConnection`. Since the service would have been created during the
metadata ingestion, we can let the Ingestion Framework dynamically fetch the Service Connection information.

If, however, you are configuring the workflow with `storeServiceConnection: false`, you'll need to explicitly
define the `serviceConnection`.

{% note %}
You can find complete YAMLs in each connector [docs](/connectors) and find more information about the available
configurations.
{% /note %}

{% /codeInfo %}

{% codeInfo srNumber=3 %}
**Preparing the Workflow**

Finally, we'll prepare a function that we can execute anywhere.

It will take care of instantiating the workflow, executing it and giving us the results.
{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="ingestion.py" %}

```python {% isCodeBlock=true %}
import yaml

```

```python  {% srNumber=1 %}
from metadata.workflow.metadata import MetadataWorkflow
 

```

```python {% srNumber=2 %}

CONFIG = """
source:
  type: snowflake-lineage
  serviceName: <service name>
  sourceConfig:
    config:
      type: DatabaseLineage
      queryLogDuration: 1
      parsingTimeoutLimit: 300
      ...
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
"""

```

```python {% srNumber=3 %}

def run():
    workflow = MetadataWorkflow.create(CONFIG)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()
```

{% /codeBlock %}

{% /codePreview %}

{% note %}

You can test the workflow via `metadata ingest -c <path-to-yaml>`.

{% /note %}


### Usage Workflow

As with the lineage workflow, we'll scan the query history for any DML statements. The goal is to ingest queries
into the platform, figure out the relevancy of your assets and frequently joined tables.

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=1 %}
**Adding the imports**

The first step is to import the `UsageWorkflow` class, which will take care of the full ingestion logic. We'll
add the import for printing the results at the end.

{% /codeInfo %}

{% codeInfo srNumber=2 %}
**Defining the YAML**

Then, we need to pass the YAML configuration. For this simple example we are defining a variable, but you can
read from a file, parse secrets from your environment, or any other approach you'd need.

Note how we have not added here the `serviceConnection`. Since the service would have been created during the
metadata ingestion, we can let the Ingestion Framework dynamically fetch the Service Connection information.

If, however, you are configuring the workflow with `storeServiceConnection: false`, you'll need to explicitly
define the `serviceConnection`.


{% note %}
You can find complete YAMLs in each connector [docs](/connectors) and find more information about the available
configurations.
{% /note %}

{% /codeInfo %}

{% codeInfo srNumber=3 %}
**Preparing the Workflow**

Finally, we'll prepare a function that we can execute anywhere.

It will take care of instantiating the workflow, executing it and giving us the results.
{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="ingestion.py" %}

```python {% isCodeBlock=true %}
import yaml

```

```python  {% srNumber=1 %}
from metadata.workflow.usage import UsageWorkflow
 

```

```python {% srNumber=2 %}

CONFIG = """
source:
  type: snowflake-usage
  serviceName: <service name>
  sourceConfig:
    config:
      type: DatabaseUsage
      queryLogDuration: 1
      parsingTimeoutLimit: 300
      ...
processor:
  type: query-parser
  config: {}
stage:
  type: table-usage
  config:
    filename: "/tmp/snowflake_usage"
bulkSink:
  type: metadata-usage
  config:
    filename: "/tmp/snowflake_usage"
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
"""

```

```python {% srNumber=3 %}

def run():
    workflow = UsageWorkflow.create(CONFIG)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()
```

{% /codeBlock %}

{% /codePreview %}

{% note %}

You can test the workflow via `metadata usage -c <path-to-yaml>`.

{% /note %}

### Profiler Workflow

This workflow will execute queries against your database and send the results into OpenMetadata. The goal is to compute
metrics about your data and give you a high-level view of its shape, together with the sample data.

This is an interesting previous step before creating Data Quality Workflows.

You can find more information about this workflow [here](/how-to-guides/data-quality-observability/profiler/workflow).

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=1 %}
**Adding the imports**

The first step is to import the `ProfilerWorkflow` class, which will take care of the full ingestion logic. We'll
add the import for printing the results at the end.

{% /codeInfo %}

{% codeInfo srNumber=2 %}
**Defining the YAML**

Then, we need to pass the YAML configuration. For this simple example we are defining a variable, but you can
read from a file, parse secrets from your environment, or any other approach you'd need.

Note how we have not added here the `serviceConnection`. Since the service would have been created during the
metadata ingestion, we can let the Ingestion Framework dynamically fetch the Service Connection information.

If, however, you are configuring the workflow with `storeServiceConnection: false`, you'll need to explicitly
define the `serviceConnection`.

{% note %}
You can find complete YAMLs in each connector [docs](/connectors) and find more information about the available
configurations.
{% /note %}

{% /codeInfo %}

{% codeInfo srNumber=3 %}
**Preparing the Workflow**

Finally, we'll prepare a function that we can execute anywhere.

It will take care of instantiating the workflow, executing it and giving us the results.
{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="ingestion.py" %}

```python {% isCodeBlock=true %}
import yaml

```

```python  {% srNumber=1 %}
from metadata.workflow.profiler import ProfilerWorkflow
 

```

```python {% srNumber=2 %}

CONFIG = """
source:
  type: snowflake
  serviceName: <service name>
  sourceConfig:
    config:
      type: Profiler
      generateSampleData: true
      ...
processor:
  type: orm-profiler
  config: {}
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
"""

```

```python {% srNumber=3 %}

def run():
    workflow = ProfilerWorkflow.create(CONFIG)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()
```

{% /codeBlock %}

{% /codePreview %}

{% note %}

You can test the workflow via `metadata profile -c <path-to-yaml>`.

{% /note %}


### Data Quality Workflow

This workflow will execute queries against your database and send the results into OpenMetadata. The goal is to compute
metrics about your data and give you a high-level view of its shape, together with the sample data.

This is an interesting previous step before creating Data Quality Workflows.

You can find more information about this workflow [here](/how-to-guides/data-quality-observability/quality/configure).

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=1 %}
**Adding the imports**

The first step is to import the `TestSuiteWorkflow` class, which will take care of the full ingestion logic. We'll
add the import for printing the results at the end.

{% /codeInfo %}

{% codeInfo srNumber=2 %}
**Defining the YAML**

Then, we need to pass the YAML configuration. For this simple example we are defining a variable, but you can
read from a file, parse secrets from your environment, or any other approach you'd need.

Note how we have not added here the `serviceConnection`. Since the service would have been created during the
metadata ingestion, we can let the Ingestion Framework dynamically fetch the Service Connection information.

If, however, you are configuring the workflow with `storeServiceConnection: false`, you'll need to explicitly
define the `serviceConnection`.

Moreover, see how we are not configuring any tests in the `processor`. You can do [that](/how-to-guides/data-quality-observability/quality/configure#full-yaml-config-example),
but even if nothing gets defined in the YAML, we will execute all the tests configured against the table.

{% note %}
You can find complete YAMLs in each connector [docs](/connectors) and find more information about the available
configurations.
{% /note %}

{% /codeInfo %}

{% codeInfo srNumber=3 %}
**Preparing the Workflow**

Finally, we'll prepare a function that we can execute anywhere.

It will take care of instantiating the workflow, executing it and giving us the results.
{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="ingestion.py" %}

```python {% isCodeBlock=true %}
import yaml

```

```python  {% srNumber=1 %}
from metadata.workflow.data_quality import TestSuiteWorkflow
 

```

```python {% srNumber=2 %}

CONFIG = """
source:
  type: TestSuite
  serviceName: <service name>
  sourceConfig:
    config:
      type: TestSuite
      entityFullyQualifiedName: <Table FQN, e.g., `service.database.schema.table`>
processor:
  type: orm-test-runner
  config: {}
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
"""

```

```python {% srNumber=3 %}

def run():
    workflow = TestSuiteWorkflow.create(CONFIG)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()
```

{% /codeBlock %}

{% /codePreview %}

{% note %}

You can test the workflow via `metadata test -c <path-to-yaml>`.

{% /note %}
