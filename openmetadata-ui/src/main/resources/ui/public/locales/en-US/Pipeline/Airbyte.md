# Airbyte

In this section, we provide guides and references to use the Airbyte connector. You can view the full documentation for Airbyte <a href="https://docs.open-metadata.org/connectors/pipeline/airbyte" target="_blank">here</a>.

## Requirements

We extract Airbyte's metadata by using its <a href="https://docs.airbyte.com/api-documentation/" target="_blank">API</a>. To run this ingestion, you just need a user with permissions to the Airbyte instance.

You can find further information on the Airbyte connector in the <a href="https://docs.open-metadata.org/connectors/pipeline/airbyte" target="_blank">docs</a>.

## Connection Details

$$section
### Host and Port $(id="hostPort")
Enter the full service endpoint as a URI in the format scheme://hostname:port.
Examples:
- Local: http://localhost:8000
- Docker: http://host.docker.internal:8000
- Airbyte Cloud: https://api.airbyte.com
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
### Client ID $(id="clientId")
Client ID for the application registered in Airbyte.
$$

$$section
### Client Secret $(id="clientSecret")
Client Secret for the application registered in Airbyte.
$$

$$section
### Api Version $(id="apiVersion")

The Airbyte REST API version to use. Defaults to `api/v1`.
For Airbyte Cloud, you may simply use `v1`.
$$