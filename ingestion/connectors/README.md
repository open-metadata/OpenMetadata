# Ingestion Framework Connectors

Directory containing the necessary Dockerfiles to prepare the images that will hold the Connectors' code.

These images can then be used either in isolation or as `DockerOperator` in Airflow ingestions.

- `Dockerfile-base` contains the minimum basic requirements for all Connectors, i.e., the ingestion framework with the base requirements.

All the connector's images will be based on this basic image, and they will only add the necessary extra dependencies to run their own connector.

The Connector images will be named `ingestion-connector-${connectorName}`.
