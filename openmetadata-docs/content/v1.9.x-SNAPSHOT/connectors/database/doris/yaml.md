---
title: Run the Doris Connector Externally
slug: /connectors/database/doris/yaml
---

{% connectorDetailsHeader
name="Doris"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "dbt", "Sample Data", "Auto-Classification"]
unavailableFeatures=["Query Usage", "Lineage", "Column-level Lineage", "Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Doris connector.

Configure and schedule Doris metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [dbt Integration](#dbt-integration)
- [Enable Security](#securing-doris-connection-with-ssl-in-openmetadata)

{% partial file="/v1.9/connectors/external-ingestion-deployment.md" /%}

## Requirements

Metadata: Doris >= 1.2.0, Data Profiler: Doris >= 2.0.2

### Python Requirements

{% partial file="/v1.9/connectors/python-requirements.md" /%}

To run the Doris ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[doris]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/dorisConnection.json)
you can find the structure to create a connection to Doris.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Doris:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to Doris. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password to connect to Doris.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**Host and Port**: Enter the fully qualified hostname and port number for your Doris deployment in the Host and Port field.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**databaseSchema**: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.

{% /codeInfo %}

{% partial file="/v1.9/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=6 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to database during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: doris
  serviceName: <service name>
  serviceConnection:
    config:
      type: Doris
```
```yaml {% srNumber=1 %}
      username: <username>
```
```yaml {% srNumber=2 %}
      password: <password>
```
```yaml {% srNumber=4 %}
      hostPort: <hostPort>
```
```yaml {% srNumber=5 %}
      databaseSchema: schema
```

```yaml {% srNumber=6 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=7 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.9/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.9/connectors/yaml/ingestion-cli.md" /%}

{% partial file="/v1.9/connectors/yaml/data-profiler.md" variables={connector: "doris"} /%}

{% partial file="/v1.9/connectors/yaml/auto-classification.md" variables={connector: "doris"} /%}

{% partial file="/v1.9/connectors/yaml/data-quality.md" /%}

## Securing Doris Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and Doris, navigate to the Advanced Config section. Here, you can provide the CA certificate used for SSL validation by specifying the `caCertificate`. Alternatively, if both client and server require mutual authentication, you'll need to use all three parameters: `ssl_key`, `ssl_cert`, and `ssl_ca`. In this case, `ssl_cert` is used for the client’s SSL certificate, `ssl_key` for the private key associated with the SSL certificate, and `ssl_ca` for the CA certificate to validate the server’s certificate.

```yaml
      sslConfig:
            caCertificate: "/path/to/ca_certificate"
            sslCertificate: "/path/to/your/ssl_cert"
            sslKey: "/path/to/your/ssl_key"
```

## Lineage

You can learn more about how to ingest lineage [here](/connectors/ingestion/workflows/lineage).

## dbt Integration

You can learn more about how to ingest dbt models' definitions and their lineage [here](/connectors/ingestion/workflows/dbt).

