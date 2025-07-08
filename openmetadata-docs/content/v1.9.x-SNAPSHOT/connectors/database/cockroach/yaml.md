---
title: Run the Cockroach Connector Externally
slug: /connectors/database/cockroach/yaml
---

{% connectorDetailsHeader
name="Cockroach"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Quality", "Data Profiler"]
unavailableFeatures=["Query Usage", "dbt", "Owners", "Lineage", "Column-level Lineage", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Cockroach connector.

Configure and schedule Cockroach metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/cockroach/yaml"} /%}

{% partial file="/v1.9/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.9/connectors/python-requirements.md" /%}

To run the Cockroach ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[cockroach]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/cockroachConnection.json)
you can find the structure to create a connection to Cockroach.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Cockroach:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to Cockroach. It should have enough privileges to read all the metadata.

{% /codeInfo %}
{% codeInfo srNumber=2 %}

**authType**: Choose from basic auth and IAM based auth.
#### Basic Auth

**password**: Password comes under Basic Auth type.

{% /codeInfo %}

{% codeInfo srNumber=3 %}


**hostPort**: Enter the fully qualified hostname and port number for your Cockroach deployment in the Host and Port field.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**database**: Initial Cockroach database to connect to. If you want to ingest all databases, set ingestAllDatabases to true.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**ingestAllDatabases**: Ingest data from all databases in Cockroach. You can use databaseFilterPattern on top of this.

{% /codeInfo %}

{% partial file="/v1.9/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration


{% codeInfo srNumber=6 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=9 %}

The sslConfig and sslMode are used to configure the SSL (Secure Sockets Layer) connection between your application and the Cockroach server. Cockroach will require only rootCertificate i.e caCertificate.

**caCertificate**: This is the path to the CA (Certificate Authority) certificate file. This file is used to verify the server’s certificate.

**sslMode**: This field controls whether a secure SSL/TLS connection will be negotiated with the server. There are several modes you can choose:

disable: No SSL/TLS encryption will be used; the data sent over the network is not encrypted.
allow: The driver will try to negotiate a non-SSL connection but if the server insists on SSL, it will switch to SSL.
prefer (the default): The driver will try to negotiate an SSL connection but if the server does not support SSL, it will switch to a non-SSL connection.
require: The driver will try to negotiate an SSL connection. If the server does not support SSL, the driver will not fall back to a non-SSL connection.
verify-ca: The driver will negotiate an SSL connection and verify that the server certificate is issued by a trusted certificate authority (CA).
verify-full: The driver will negotiate an SSL connection, verify that the server certificate is issued by a trusted CA and check that the server host name matches the one in the certificate.


{% /codeInfo %}


{% /codeInfoContainer %}

{% codeBlock fileName="cockroach.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: cockroach
  serviceName: local_cockroach
  serviceConnection:
    config:
      type: Cockroach
```
```yaml {% srNumber=1 %}
      username: username
```
```yaml {% srNumber=2 %}
      authType: 
            password: <password>
```
```yaml {% srNumber=3 %}
      hostPort: localhost:26257
```
```yaml {% srNumber=4 %}
      database: database
```
```yaml {% srNumber=6 %}
      ingestAllDatabases: true
```
```yaml {% srNumber=9 %}
      # sslConfig:
            # caCertificate: "path/to/ca/certificate"
      # sslMode: disable #allow prefer require verify-ca verify-full
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

{% partial file="/v1.9/connectors/yaml/data-profiler.md" variables={connector: "cockroach"} /%}

{% partial file="/v1.9/connectors/yaml/data-quality.md" /%}

## Securing Cockroach Connection with SSL in OpenMetadata

To configure SSL for secure connections between OpenMetadata and a Cockroach database, Cockroach offers various SSL modes, each providing different levels of connection security.

When running the ingestion process externally, specify the SSL mode to be used for the Cockroach connection, such as `prefer`, `verify-ca`, `allow`, and others. Once you've chosen the SSL mode, provide the CA certificate for SSL validation (`caCertificate`). Only the CA certificate is required for SSL validation in Cockroach.

{% note %}

For IAM authentication, it is recommended to select the `allow` mode or another SSL mode that aligns with your specific needs.

{% /note %}

```yaml
      sslMode: disable #allow prefer require verify-ca verify-full
      sslConfig:
            caCertificate: "/path/to/ca/certificate" 
```