## Ingestion Deployment

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment. If you want to install it manually in an already existing
Airflow host, you can follow [this](/deployment/ingestion/openmetadata) guide.

If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check
the following docs to run the Ingestion Framework in any orchestrator externally.

{% tilesContainer %}
{% tile
    title="Run Connectors from the OpenMetadata UI"
    description="Learn how to manage your deployment to run connectors from the UI"
    link="/deployment/ingestion/openmetadata"
  / %}
{% tile
    title="Run the Connector Externally"
    description="Get the YAML to run the ingestion externally"
    link=$yamlPath
  / %}
{% tile
    title="External Schedulers"
    description="Get more information about running the Ingestion Framework Externally"
    link="/deployment/ingestion"
  / %}
{% /tilesContainer %}
