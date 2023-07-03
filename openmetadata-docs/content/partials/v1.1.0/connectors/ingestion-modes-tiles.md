If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check
the following docs to run the Ingestion Framework in any orchestrator externally.

{% tilesContainer %}

{% tile
    title="Ingest with Airflow"
    description="Configure the ingestion using Airflow SDK"
    link="/connectors/database/athena/airflow"
  / %}
{% tile
    title="Ingest with the CLI"
    description="Run a one-time ingestion using the metadata CLI"
    link="/connectors/database/$connector/cli"
  / %}

{% /tilesContainer %}