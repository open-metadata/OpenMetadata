---
title: Run the SAP ERP Connector Externally
slug: /connectors/database/sap-erp/yaml
---

{% connectorDetailsHeader
name="SAP ERP"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Stored Procedures", "Owners", "Tags","Data Profiler", "Data Quality", "View Lineage", "View Column-level Lineage", "dbt", "Sample Data"]
/ %}

In this section, we provide guides and references to use the SAP ERP connector.

Configure and schedule SAP ERP metadata workflow externally:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 1.1 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To ingest the SAP ERP metadata, CDS Views and OData services need to be setup to efficiently expose SAP data. To achieve this, data must be exposed via RESTful interfaces.
Follow the guide [here](/connectors/database/sap-erp/setup-sap-apis) to setup the APIs.


### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

To run the SAP ERP ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[sap-erp]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/sapErpConnection.json)
you can find the structure to create a connection to SAP ERP.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for SAP ERP:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: Host and port of the SAP ERP service. This specifies the host and port of the SAP ERP instance. It should be specified as a string in the format `https://hostname.com`.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**apiKey**: Api Key to authenticate the SAP ERP Apis

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**databaseName**: In OpenMetadata, the Database Service hierarchy works as follows:
`Database Service > Database > Schema > Table`
In the case of SAP ERP, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**databaseSchema**: In OpenMetadata, the Database Service hierarchy works as follows:
`Database Service > Database > Schema > Table`
In the case of SAP ERP, we won't have a Database Schema as such. If you'd like to see your data in a database schema named something other than `default`, you can specify the name in this field.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**paginationLimit**: Pagination limit used while querying the SAP ERP API for fetching the entities.

{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

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
  type: SapErp
  serviceName: <service name>
  serviceConnection:
    config:
      type: SapErp
```
```yaml {% srNumber=1 %}
      hostPort: https://localhost.com
```
```yaml {% srNumber=2 %}
      apiKey: api_key
```
```yaml {% srNumber=3 %}
      databaseName: databaseName
```
```yaml {% srNumber=4 %}
      databaseSchema: databaseSchema
```
```yaml {% srNumber=5 %}
      paginationLimit: 100
```
```yaml {% srNumber=9 %}
      # sslConfig:
            # caCertificate: "path/to/ca/certificate"
      # sslMode: disable #allow prefer require verify-ca verify-full
```
```yaml {% srNumber=6 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=7 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.7/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}

## Securing SAP ERP Connection with SSL in OpenMetadata

To configure SSL for secure connections between OpenMetadata and a Redshift database, Redshift offers various SSL modes, each providing different levels of connection security.

When running the ingestion process externally, specify the SSL mode to be used for the Redshift connection, such as `prefer`, `verify-ca`, `allow`, and others. Once you've chosen the SSL mode, provide the CA certificate for SSL validation (`caCertificate`). Only the CA certificate is required for SSL validation in Redshift.

```yaml
      sslMode: disable #allow prefer require verify-ca verify-full
      sslConfig:
            caCertificate: "/path/to/ca/certificate" 
```

## dbt Integration

{% tilesContainer %}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}
