---
title: Ingestion Framework Deployment
slug: /deployment/ingestion
---

# Ingestion Framework Deployment

The Ingestion Framework is the module that takes care of bringing metadata in to OpenMetadata. It is used
for any type of workflow that is supported in the platform: Metadata, Lineage, Usage, Profiler, Data Quality,...

## Manage & Schedule the Ingestion Framework

In this guide, we will present the different alternatives to run and manage your ingestion workflows. There are mainly
2 ways of running the ingestion:
1. Internally, by managing the workflows from OpenMetadata.
2. Externally, by using any other tool capable of running Python code.

Note that the end result is going to be the same. The only difference is that running the workflows internally,
OpenMetadata will dynamically generate the processes that will perform the metadata extraction. If configuring
the ingestion externally, you will be managing this processes directly on your platform of choice.

### Option 1 - From OpenMetadata

If you want to learn how to configure your setup to run them from OpenMetadata, follow this guide:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="10k"
    bold="OpenMetadata UI"
    href="/deployment/ingestion/openmetadata" %}
    Deploy, configure and manage the ingestion workflows directly from the OpenMetadata UI.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

### Option 2 - Externally

Any tool capable of running Python code can be used to configure the metadata extraction from your sources.

In this section, we are going to give you some background on how the Ingestion Framework works, how to configure
the metadata extraction, and some examples on how to host the ingestion in different platforms.

### 1. How does the Ingestion Framework work?

The Ingestion Framework contains all the logic about how to connect to the sources, extract their metadata
and send it to the OpenMetadata server. We have built it from scratch with the main idea of making it an independent
component that can be run from - literally - anywhere.

In order to install it, you just need to get it from [PyPI](https://pypi.org/project/openmetadata-ingestion/).

We will show further examples later, but a piece of code is the best showcase for its simplicity. In order to run
a full ingestion process, you just need to execute a single function. For example, if we wanted to run the ingestion
from within a simple YAML script:

```python
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.workflow_output_handler import print_status

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
    print_status(workflow)
    workflow.stop()


if __name__ == "__main__":
  run()
```

Where this function runs is completely up to you, and you can adapt it to what makes the most sense within your
organization and engineering context. Below you'll see some examples of different orchestrators you can leverage
to execute the ingestion process.

### 2. Ingestion Configuration

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

If you need to get the YAML shape of any connector, you can pick it up from its doc [page](/connectors).

Additionally, if you want to see your runs logged in the `Ingestions` tab of the connectors page as you would
when running the connectors natively with OpenMetadata, you can add the following configuration on your YAMLs:

```yaml
source:
  type: mysql
  serviceName: mysql
[...]
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: openmetadata
    securityConfig:
      jwtToken: ...
ingestionPipelineFQN: <serviceName>.<pipelineName>  # E.g., mysql.marketing_metadata`
```

Adding the `ingestionPipelineFQN` - the Ingestion Pipeline Fully Qualified Name - will tell the Ingestion Framework
to log the executions and update the ingestion status, which will appear on the UI. Note that the action buttons
will be disabled, since OpenMetadata won't be able to interact with external systems.

### 3. (Optional) Disable the Pipeline Service Client

If you want to run your workflows **ONLY externally** without relying on OpenMetadata for any workflow management
or scheduling, you can update the following server configuration:

```yaml
pipelineServiceClientConfiguration:
  enabled: ${PIPELINE_SERVICE_CLIENT_ENABLED:-true}
```

by setting `enabled: false` or setting the `PIPELINE_SERVICE_CLIENT_ENABLED=false` as an environment variable.

This will stop certain APIs and monitors related to the Pipeline Service Client (e.g., Airflow) from being operative.

### Examples

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
    href="/deployment/ingestion/airflow" %}
    Run the ingestion process externally from Airflow
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="10k"
    bold="MWAA"
    href="/deployment/ingestion/mwaa" %}
    Run the ingestion process externally using AWS MWAA
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="10k"
    bold="GCS Composer"
    href="/deployment/ingestion/gcs-composer" %}
    Run the ingestion process externally from GCS Composer
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="10k"
    bold="GitHub Actions"
    href="/deployment/ingestion/github-actions" %}
    Run the ingestion process externally from GitHub Actions
  {% /inlineCallout %}
{% /inlineCalloutContainer %}


### 