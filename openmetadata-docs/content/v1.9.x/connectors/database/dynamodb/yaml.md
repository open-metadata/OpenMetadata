---
title: Run the Athena Connector Externally
description: Use YAML to ingest metadata from DynamoDB, capturing key attributes and schema-less data insights for better governance.
slug: /connectors/database/dynamodb/yaml
---

{% connectorDetailsHeader
name="DynamoDB"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Auto-Classification"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures", "Data Quality", "Lineage", "Column-level Lineage", "dbt", "Sample Data"]
/ %}

In this section, we provide guides and references to use the DynamoDB connector.

Configure and schedule DynamoDB metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.9/connectors/external-ingestion-deployment.md" /%}

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

### Python Requirements

{% partial file="/v1.9/connectors/python-requirements.md" /%}

To run the DynamoDB ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[dynamodb]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/dynamoDBConnection.json)
you can find the structure to create a connection to DynamoDB.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for DynamoDB:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% partial file="/v1.9/connectors/yaml/common/aws-config-def.md" /%}

{% codeInfo srNumber=6 %}

**databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.

{% /codeInfo %}

{% partial file="/v1.9/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=7 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to database during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: dynamodb
  serviceName: local_dynamodb
  serviceConnection:
    config:
      type: DynamoDB
      awsConfig:
```

{% partial file="/v1.9/connectors/yaml/common/aws-config.md" /%}

```yaml {% srNumber=6 %}
      database: custom_database_name
```
```yaml {% srNumber=7 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=8 %}
      # connectionArguments:
      #   key: value
```


{% partial file="/v1.9/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.9/connectors/yaml/ingestion-cli.md" /%}


## dbt Integration

{% tilesContainer %}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}
