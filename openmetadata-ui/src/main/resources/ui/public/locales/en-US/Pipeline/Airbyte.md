# Airbyte

In this section, we provide guides and references to use the Airbyte connector. You can view the full documentation for Airbyte <a href="https://docs.open-metadata.org/connectors/pipeline/airbyte" target="_blank">here</a>.

## Requirements

We extract Airbyte's metadata by using its <a href="https://docs.airbyte.com/api-documentation/" target="_blank">API</a>. To run this ingestion, you just need a user with permissions to the Airbyte instance.

You can find further information on the Airbyte connector in the <a href="https://docs.open-metadata.org/connectors/pipeline/airbyte" target="_blank">docs</a>.

## Connection Details

$$section
### Host and Port $(id="hostPort")

Pipeline Service Management URI. This should be specified as a URI string in the format `scheme://hostname:port`. E.g., `http://localhost:8000`, `http://host.docker.internal:8000`.
$$

$$section
### Username $(id="username")
Username to connect to Airbyte.
$$

$$section
### Password $(id="password")
Password to connect to Airbyte.
$$

$$section
### Api Version $(id="apiVersion")

Version of the Airbyte REST API by default `api/v1`.
$$