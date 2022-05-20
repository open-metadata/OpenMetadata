---
description: >-
  Learn how to use the workflow deployment from the UI with a simple
  configuration.
---

# Configure Airflow in the OpenMetadata Server

## Prerequisites

This page will guide you on setting up the link between your Airflow host and the OpenMetadata server. Note that to enable the workflow deployment from the UI, you need the Airflow APIs correctly installed in your Airflow host.

This can be done either by using our custom Docker [image](https://hub.docker.com/r/openmetadata/ingestion) or following this [guide](custom-airflow-installation.md) to set up your existing Airflow service.

## Configuration

The OpenMetadata server takes all its configurations from a YAML file. You can find them in our [repo](https://github.com/open-metadata/OpenMetadata/tree/main/conf). In either `openmetadata-security.yaml` or `openmetadata.yaml`, update the `airflowConfiguration` section accordingly.

{% code title="openmetadata.yaml" %}
```
[...]

airflowConfiguration:
  apiEndpoint: http://${AIRFLOW_HOST:-localhost}:${AIRFLOW_PORT:-8080}
  username: ${AIRFLOW_USERNAME:-admin}
  password: ${AIRFLOW_PASSWORD:-admin}
  metadataApiEndpoint: http://${SERVER_HOST:-localhost}:${SERVER_PORT:-8585}/api
  authProvider: "no-auth"
```
{% endcode %}

Note that we also support picking up these values from environment variables, so you can safely set that up in the machine hosting the OpenMetadata server.

## Connectors

Once this configuration is done, you can head to any of the [Connectors](configure-airflow-in-the-openmetadata-server.md#undefined) to find detailed guides on how to deploy an ingestion workflow from the UI.
