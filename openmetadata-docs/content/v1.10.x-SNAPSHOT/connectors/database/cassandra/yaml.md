---
title: Run the Cassandra Connector Externally
description: Use YAML to ingest metadata from Apache Cassandra, including keyspaces, tables, and columns.
slug: /connectors/database/cassandra/yaml
---

{% connectorDetailsHeader
name="Cassandra"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Data Quality", "dbt", "Owners", "Lineage", "Column-level Lineage", "Tags", "Stored Procedures","Data Profiler", "Auto-Classification"]
/ %}

In this section, we provide guides and references to use the Cassandra connector.

Configure and schedule Cassandra metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Enable Security](#securing-cassandra-connection-with-ssl-in-openmetadata)


{% partial file="/v1.10/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/cassandra/yaml"} /%}

{% partial file="/v1.10/connectors/external-ingestion-deployment.md" /%}

## Requirements

To extract metadata using the Cassandra connector, ensure the user in the connection has the following permissions:
- Read Permissions: The ability to query tables and perform data extraction.
- Schema Operations: Access to list and describe keyspaces and tables.


### Python Requirements

{% partial file="/v1.10/connectors/python-requirements.md" /%}

To run the Cassandra ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[cassandra]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/cassandraConnection.json)
you can find the structure to create a connection to Cassandra.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Cassandra:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Username to connect to Cassandra. This user must have the necessary permissions to perform metadata extraction and table queries.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: When using the `cassandra` connecion schema, the hostPort parameter specifies the host and port of the Cassandra. This should be specified as a string in the format `hostname:port`. E.g., `localhost:9042`.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**Auth Type**: Following authentication types are supported:
1. **Basic Authentication**:
We'll use the user credentials to connect to Cassandra
- **password**: Password of the user.

2. **DataStax Astra DB Configuration**: 
Configuration for connecting to DataStax Astra DB in the cloud.
  - **secureConnectBundle**: File path to the Secure Connect Bundle (.zip) used for a secure connection to DataStax Astra DB.
  - **token**: The Astra DB application token used for authentication.
  - **connectTimeout**: Timeout in seconds for establishing new connections to Cassandra.
  - **requestTimeout**: Timeout in seconds for individual Cassandra requests.

{% /codeInfo %}

{% partial file="/v1.10/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.10/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.10/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=6 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

The sslConfig and sslMode are used to configure the SSL (Secure Sockets Layer) connection between your application and the PostgreSQL server.

- **caCertificate**: Provide the path to ssl ca file.

- **sslCertificate**: Provide the path to ssl client certificate file (ssl_cert).

- **sslKey**: Provide the path to ssl client certificate file (ssl_key).

**sslMode**: This field controls whether a secure SSL/TLS connection will be negotiated with the server. There are several modes you can choose:

disable: No SSL/TLS encryption will be used; the data sent over the network is not encrypted.
allow: The driver will try to negotiate a non-SSL connection but if the server insists on SSL, it will switch to SSL.
prefer (the default): The driver will try to negotiate an SSL connection but if the server does not support SSL, it will switch to a non-SSL connection.
require: The driver will try to negotiate an SSL connection. If the server does not support SSL, the driver will not fall back to a non-SSL connection.
verify-ca: The driver will negotiate an SSL connection and verify that the server certificate is issued by a trusted certificate authority (CA).
verify-full: The driver will negotiate an SSL connection, verify that the server certificate is issued by a trusted CA and check that the server host name matches the one in the certificate.

{% /codeInfo %}

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="cassandra.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: cassandra
  serviceName: local_cassandra
  serviceConnection:
    config:
      type: Cassandra
```
```yaml {% srNumber=1 %}
      username: username
```
```yaml {% srNumber=3 %}
      hostPort: localhost:9042
```
```yaml {% srNumber=4 %}
      databaseName: custom_database_name
```
```yaml {% srNumber=5 %}
      authType:
        password: password
        cloudConfig:
          secureConnectBundle: <SCB File Path>
          token: <Token String>
          requestTimeout: <Timeout in seconds>
          connectTimeout: <Timeout in seconds>
```
```yaml {% srNumber=6 %}
      # connectionArguments:
      #   key: value
```
```yaml {% srNumber=7 %}
      # sslConfig:
            # caCertificate: "path/to/ca/certificate"
            # sslCertificate: "path/to/ssl/certificate"
            # sslKey: "path/to/ssl/key"
      # sslMode: disable #allow prefer require verify-ca verify-full
```


{% partial file="/v1.10/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.10/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.10/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.10/connectors/yaml/ingestion-cli.md" /%}

## Securing Cassandra Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and a Cassandra database, you can use any SSL mode provided by Cassandra, except disable.

Under `Advanced Config`, after selecting the SSL mode, provide the CA certificate, SSL certificate and SSL key.

```yaml
      sslMode: allow
      sslConfig:
            caCertificate: "/path/to/ca/certificate"
            sslCertificate: "/path/to/ssl/certificate"
            sslKey: "/path/to/ssl/key"
```