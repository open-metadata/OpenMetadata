---
title: DynamoDB
slug: /connectors/database/dynamodb
---

{% connectorDetailsHeader
name="DynamoDB"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt"]
/ %}


In this section, we provide guides and references to use the DynamoDB connector.

Configure and schedule DynamoDB metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/dynamodb/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/dynamodb/connections) user credentials with the DynamoDB connector.

## Requirements

The DynamoDB connector ingests metadata using the DynamoDB boto3 client.

OpenMetadata retrieves information about all tables in the AWS account, the user must have permissions to perform the `dynamodb:ListTables` operation.

Below defined policy grants the permissions to list all tables in DynamoDB:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:ListTables"
            ],
            "Resource": "*"
        }
    ]
}
```

For more information on Dynamodb permissions visit the [AWS DynamoDB official documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/api-permissions-reference.html).

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "DynamoDB", 
    selectServicePath: "/images/v1.7/connectors/dynamodb/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/dynamodb/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/dynamodb/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}
