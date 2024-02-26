---
title: Run the Glue Connector Externally
slug: /connectors/database/glue/yaml
---

{% connectorDetailsHeader
name="Glue"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "dbt"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage"]
/ %}

In this section, we provide guides and references to use the Glue connector.

Configure and schedule Glue metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

User must have `glue:GetDatabases` and `glue:GetTables` permissions to ingest the basic metadata.

### Python Requirements

To run the Glue ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[glue]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/glueConnection.json)
you can find the structure to create a connection to Glue.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Glue:


{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**awsAccessKeyId**: Enter your secure access key ID for your Glue connection. The specified key ID should be authorized to read all databases you want to include in the metadata ingestion workflow.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**awsSecretAccessKey**: Enter the Secret Access Key (the passcode key pair to the key ID from above).

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**awsRegion**: Enter the location of the amazon cluster that your data and account are associated with.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**endPointURL**: Your Glue connector will automatically determine the AWS Glue endpoint URL based on the region. You may override this behavior by entering a value to the endpoint URL.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**awsSessionToken**: The AWS session token is an optional parameter. If you want, enter the details of your temporary session token.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use [Glue Catalog ID](https://docs.aws.amazon.com/glue/latest/dg/glue-specifying-resource-arns.html#data-catalog-resource-arns) as the database name.

{% /codeInfo %}


{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=7 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: glue
  serviceName: local_glue
  serviceConnection:
    config:
      type: Glue
      awsConfig:
```
```yaml {% srNumber=1 %}
        awsAccessKeyId: KEY
```
```yaml {% srNumber=2 %}
        awsSecretAccessKey: SECRET
```
```yaml {% srNumber=3 %}
        awsRegion: us-east-2
```
```yaml {% srNumber=4 %}
        # endPointURL: https://glue.us-east-2.amazonaws.com/
```
```yaml {% srNumber=5 %}
        # awsSessionToken: TOKEN
```
```yaml {% srNumber=6 %}
      databaseName: database_name
```
```yaml {% srNumber=7 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=8 %}
      # connectionArguments:
      #   key: value
```


{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}


## dbt Integration

{% tilesContainer %}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}
