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
2. Externally, by using any other tool capable or running Python code.

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

If, instead, you want to manage them from any other system, you would need a bit more background:
1. How does the Ingestion Framework work?
2. Ingestion Configuration

### 1. How does the Ingestion Framework work?

The Ingestion Framework contains all the logic about how to connect to the sources, extract their metadata
and send it to the OpenMetadata server. We have built it from scratch with the main idea of making it an independent
component that can be run from - literally - anywhere.

In order to install it, you just need to get it from [PyPI](https://pypi.org/project/openmetadata-ingestion/).

We will show further examples later, but a piece of code is the best showcase for its simplicity. In order to run
a full ingestion process, you just need to execute a single function:

```python
def run():
    workflow_config = yaml.safe_load(CONFIG)
    workflow = Workflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()
```

Where this function runs is completely up to you, and you can adapt it to what makes the most sense within your
organization and engineering context.

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
