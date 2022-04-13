---
description: >-
  Learn how to configure Airflow to run the metadata ingestion, the recommended
  way to schedule the ingestions.
---

# Airflow

Use Airflow to define and deploy your metadata ingestion Workflows. This can be done in different ways:

1. If you do not have an Airflow service up and running on your platform, we provide a custom Docker [image](https://hub.docker.com/r/openmetadata/ingestion), which already contains the OpenMetadata ingestion packages and custom [Airflow APIs](https://github.com/open-metadata/openmetadata-airflow-apis) to deploy Workflows from the UI as well.
2. If you already have Airflow up and running and want to use it for the metadata ingestion, you will need to install the ingestion modules to the host. You can find more information on how to do this in the [Custom Airflow Installation](custom-airflow-installation.md) section.

## Guides

{% content-ref url="custom-airflow-installation.md" %}
[custom-airflow-installation.md](custom-airflow-installation.md)
{% endcontent-ref %}

{% content-ref url="airflow-lineage.md" %}
[airflow-lineage.md](airflow-lineage.md)
{% endcontent-ref %}

{% content-ref url="configure-airflow-in-the-openmetadata-server.md" %}
[configure-airflow-in-the-openmetadata-server.md](configure-airflow-in-the-openmetadata-server.md)
{% endcontent-ref %}

{% content-ref url="airflow.md" %}
[airflow.md](airflow.md)
{% endcontent-ref %}
