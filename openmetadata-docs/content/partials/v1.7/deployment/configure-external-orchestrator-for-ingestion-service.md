### Configure External Orchestrator Service (Ingestion Service)

OpenMetadata requires connectors to be scheduled to periodically fetch the metadata, or you can use the OpenMetadata APIs to push the metadata as well
1. OpenMetadata Ingestion Framework is flexible to run on any orchestrator. However, we built an ability to deploy and manage connectors as pipelines from the UI. This requires the Airflow container we ship.
2. If your team prefers to run on any other orchestrator such as prefect, dagster or even GitHub workflows. Please refer to our recent webinar on [How Ingestion Framework works](https://www.youtube.com/watch?v=i7DhG_gZMmE&list=PLa1l-WDhLreslIS_96s_DT_KdcDyU_Itv&index=10)