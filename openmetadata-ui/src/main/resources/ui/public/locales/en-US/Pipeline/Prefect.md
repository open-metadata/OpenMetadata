# Prefect
In this section, we provide guides and references to use the Prefect connector.

## Requirements

The ingestion framework uses the <a href="https://docs.prefect.io/latest/api-ref/rest-api/" target="_blank">Prefect REST API</a> to connect to Prefect Cloud or a self-hosted Prefect Server and fetch flows, deployments, run history, and lineage.

You can find further information on the Prefect connector in the <a href="https://docs.open-metadata.org/connectors/pipeline/prefect" target="_blank">docs</a>.

## Connection Details

$$section
### Host and Port $(id="hostPort")
Prefect API base URL. Use `https://api.prefect.cloud` for Prefect Cloud, or your self-hosted server's URL, e.g. `http://localhost:4200`.
$$

$$section
### Authentication $(id="authType")
Choose between Prefect Cloud or a self-hosted Prefect Server. Pick one of the two options from the dropdown — the corresponding fields will appear.
$$

## Prefect Cloud

$$section
### Prefect API Key $(id="apiKey")
Prefect Cloud API key for authentication. You can generate one from your <a href="https://docs.prefect.io/latest/cloud/users/api-keys" target="_blank">Prefect Cloud account settings</a>.
$$

$$section
### Account ID $(id="accountId")
Prefect Cloud Account ID. Found in the URL: `app.prefect.cloud/account/{accountId}`.
$$

$$section
### Workspace ID $(id="workspaceId")
Prefect Cloud Workspace ID. Found in the URL after `/workspaces/{workspaceId}`.
$$

## Prefect Server

$$section
### Basic Auth String $(id="authString")
Self-hosted Prefect Server Basic Auth credential (`PREFECT_SERVER_API_AUTH_STRING`), format `user:password`. Leave empty if the server has no auth enabled.
$$

$$section
### Number of Status $(id="numberOfStatus")
Number of past flow run statuses to ingest per flow. By default, we will pick up the last 10 runs.
$$

$$section
### Verify SSL $(id="verifySSL")
Client SSL verification. Make sure to configure the SSL Config if enabling this option.
$$

$$section
### SSL Config $(id="sslConfig")
Client SSL configuration. Provide a CA certificate when connecting to a Prefect instance behind an internal certificate authority.
$$
