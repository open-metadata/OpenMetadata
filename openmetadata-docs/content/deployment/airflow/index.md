---
title: Airflow Deployment
slug: /deployment/airflow
---

# Airflow

This section will show you how to configure your Airflow instance to run the OpenMetadata workflows.

Moreover, we will show the required steps to connect your Airflow instance to the OpenMetadata server
so that you can deploy with the OpenMetadata UI directly to your instance.

1. If you do not have an Airflow service up and running on your platform, we provide a custom 
   [Docker](https://hub.docker.com/r/openmetadata/ingestion) image, which already contains the OpenMetadata ingestion
   packages and custom [Airflow APIs](https://github.com/open-metadata/openmetadata-airflow-apis) to
   deploy Workflows from the UI as well.
2. If you already have Airflow up and running and want to use it for the metadata ingestion, you will 
   need to install the ingestion modules to the host. You can find more information on how to do this 
   in the Custom Airflow Installation section.

## Custom Airflow Installation

If you already have an Airflow instance up and running, you might want to reuse it to host the metadata workflows as
well. Here we will guide you on the different aspects to consider when configuring an existing Airflow.

There are three different angles here:

1. Installing the ingestion modules directly on the host to enable the [Airflow Lineage Backend](/openmetadata/connectors/pipeline/airflow/lineage-backend).
2. Installing connector modules on the host to run specific workflows. 
3. Installing the Airflow APIs to enable the workflow deployment through the UI.

Depending on what you wish to use, you might just need some of these installations. Note that the installation
commands shown below need to be run in the Airflow instances.

### Airflow Lineage Backend

Goals:

- Ingest DAGs and Tasks as Pipeline Entities when they run.
- Track DAG and Task status. 
- Document lineage as code directly on the DAG definition and ingest it when the DAGs run.

Get the necessary information to install and extract metadata from the Lineage Backend [here](/openmetadata/connectors/pipeline/airflow/lineage-backend).

### Connector Modules

Goal:

- Ingest metadata from specific sources.

The current approach we are following here is preparing the metadata ingestion DAGs as `PythonOperators`. This means that
the packages need to be present in the Airflow instances.

You will need to install:

```python
pip3 install "openmetadata-ingestion[<connector-name>]"
```

And then run the DAG as explained in each [Connector](/openmetadata/connectors).

### Airflow APIs

Goal:

- Deploy metadata ingestion workflows directly from the UI.

This process consists of three steps:

1. Install the APIs module,
2. Install the required plugins, and
3. Configure the OpenMetadata server.

The goal of this module is to add some HTTP endpoints that the UI calls for deploying the Airflow DAGs.
The first step can be achieved by running:

```python
pip3 install "openmetadata-airflow-managed-apis"
```

Then, check the Connector Modules guide above to learn how to install the `openmetadata-ingestion` package with the
necessary plugins. They are necessary because even if we install the APIs, the Airflow instance needs to have the
required libraries to connect to each source.

On top of this installation, you'll need to follow these steps:

1. Download the latest `openmetadata-airflow-apis-plugins` release from [here](https://github.com/open-metadata/OpenMetadata/releases)
2. Untar it under the `{AIRFLOW_HOME}` directory. This will create and `setup` a `plugins` directory under `{AIRFLOW_HOME}`.
3. `cp -r {AIRFLOW_HOME}/plugins/dag_templates {AIRFLOW_HOME}`.
4. `mkdir -p {AIRFLOW_HOME}/dag_generated_configs`.
5. (re)start the airflow webserver and scheduler.

### Configure in the OpenMetadata Server

After installing the Airflow APIs, you will need to update your OpenMetadata Server.

The OpenMetadata server takes all its configurations from a YAML file. You can find them in our [repo](https://github.com/open-metadata/OpenMetadata/tree/main/conf). In
`openmetadata.yaml`, update the `airflowConfiguration` section accordingly.

```yaml
[...]

airflowConfiguration:
  apiEndpoint: http://${AIRFLOW_HOST:-localhost}:${AIRFLOW_PORT:-8080}
  username: ${AIRFLOW_USERNAME:-admin}
  password: ${AIRFLOW_PASSWORD:-admin}
  metadataApiEndpoint: http://${SERVER_HOST:-localhost}:${SERVER_PORT:-8585}/api
  authProvider: "no-auth"
```

Note that we also support picking up these values from environment variables, so you can safely set that up in the
machine hosting the OpenMetadata server.

If you are running OpenMetadata with the security enabled, you can take a look at the server
configuration for each security mode:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    bold="Auth0 SSO"
    icon="add_moderator"
    href="/deployment/security/auth0"
  >
    Configure Auth0 SSO to access the UI and APIs
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    bold="Azure SSO"
    icon="add_moderator"
    href="/deployment/security/azure"
  >
    Configure Azure SSO to access the UI and APIs
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    bold="Custom OIDC SSO"
    icon="add_moderator"
    href="/deployment/security/custom-oidc"
  >
    Configure a Custom OIDC SSO to access the UI and APIs
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    bold="Google SSO"
    icon="add_moderator"
    href="/deployment/security/google"
  >
    Configure Google SSO to access the UI and APIs
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    bold="Okta SSO"
    icon="add_moderator"
    href="/deployment/security/okta"
  >
    Configure Okta SSO to access the UI and APIs
  </InlineCallout>
</InlineCalloutContainer>
