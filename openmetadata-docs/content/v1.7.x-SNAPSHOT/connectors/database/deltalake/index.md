---
title: DeltaLake
slug: /connectors/database/deltalake
---

{% connectorDetailsHeader
name="DeltaLake"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "dbt"]
unavailableFeatures=["Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "Owners", "Tags", "Stored Procedures"]
/ %}


In this section, we provide guides and references to use the Deltalake connector.

Configure and schedule Deltalake metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/deltalake/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/deltalake/connections) user credentials with the DeltaLake connector.

## Requirements

Deltalake requires to run with Python 3.8, 3.9 or 3.10. We do not yet support the Delta connector
for Python 3.11

The DeltaLake connector is able to extract the information from a **metastore** or directly from the **storage**.

If extracting directly from the storage, some extra requirements are needed depending on the storage

### S3 Permissions

To execute metadata extraction AWS account should have enough access to fetch required data. The <strong>Bucket Policy</strong> in AWS requires at least these permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::<my bucket>",
                "arn:aws:s3:::<my bucket>/*"
            ]
        }
    ]
}
```

## Metadata Ingestion

{% partial
  file="/v1.7/connectors/metadata-ingestion-ui.md"
  variables={
    connector: "Deltalake",
    selectServicePath: "/images/v1.7/connectors/deltalake/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/deltalake/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/deltalake/service-connection.png",
}
/%}

{% stepsContainer %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}
