---
title: Metabase
slug: /connectors/dashboard/metabase
---

# Metabase

| Stage      | PROD                         |
|------------|------------------------------|
| Dashboards | {% icon iconName="check" /%} |
| Charts     | {% icon iconName="check" /%} |
| Owners     | {% icon iconName="cross" /%} |
| Tags       | {% icon iconName="cross" /%} |
| Datamodels | {% icon iconName="cross" /%} |
| Lineage    | {% icon iconName="check" /%} |

In this section, we provide guides and references to use the Metabase connector.

Configure and schedule Metabase metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.2/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/metabase/yaml"} /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

## Metadata Ingestion

{% partial 
  file="/v1.2/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Metabase", 
    selectServicePath: "/images/v1.2/connectors/metabase/select-service.png",
    addNewServicePath: "/images/v1.2/connectors/metabase/add-new-service.png",
    serviceConnectionPath: "/images/v1.2/connectors/metabase/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: The hostPort parameter specifies the host and port of the Metabase instance. This should be specified as a string in the format `http://hostname:port` or `https://hostname:port`. For example, you might set the hostPort parameter to `https://org.metabase.com:3000`.
- **Username**: Username to connect to Metabase, for ex. `user@organization.com`. This user should have access to relevant dashboards and charts in Metabase to fetch the metadata.
- **Password**: Password of the user account to connect with Metabase.

{% /extraContent %}

{% partial file="/v1.2/connectors/test-connection.md" /%}

{% partial file="/v1.2/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.2/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.2/connectors/troubleshooting.md" /%}
