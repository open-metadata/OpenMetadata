---
title: Run the Iceberg Connector Externally
slug: /connectors/database/iceberg/yaml
---

{% connectorDetailsHeader
name="Iceberg"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata", "Owners"]
unavailableFeatures=["Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Iceberg connector.

Configure and schedule Greenplum metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

The requirements actually depend on the Catalog and the FileSystem used. In a nutshell, the used credentials must have access to reading the Catalog and the Metadata File.

### Glue Catalog

Must have `glue:GetDatabases`, and `glue:GetTables` permissions to be able to read the Catalog.

Must also have the `s3:GetObject` permission for the location of the Iceberg tables.

### DynamoDB Catalog

Must have `dynamodb:DescribeTable` and `dynamodb:GetItem` permissions on the Iceberg Catalog table.

Must also have the `s3:GetObject` permission for the location of the Iceberg tables.

### Hive / REST Catalog
It depends on where and how the Hive / Rest Catalog is setup and where the Iceberg files are stored.
### Python Requirements

To run the Iceberg ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[iceberg]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/icebergConnection.json)
you can find the structure to create a connection to Greenplum.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

## 1. Define the YAML Config

### This is a sample config for Iceberg using a Glue Catalog:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

* **name**: Enter the catalog name of choice.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

* **awsAccessKeyId**: Enter your secure access key ID for your AWS connection.
* **awsSecretAccessKey**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
* **awsSessionToken (optional)**: Enter the Session Access Token (used if using short lived credentials).
* **awsRegion**: Specify the AWS region used.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

* **databaseName (optional)**: Enter the database name of choice. If not it will be set as 'default'.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

* **ownershipProperty (optional)**: Property to use when searching for the owner. It defaults to 'owner'.

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: iceberg
  serviceName: glue_test
  serviceConnection:
    config:
      type: Iceberg
      catalog:
```
```yaml {% srNumber=1 %}
        name: my_glue
```
```yaml
        connection:
```
```yaml {% srNumber=2 %}
          awsConfig:
              awsAccessKeyId: access key id
              awsSecretAccessKey: access secret key
              awsRegion: aws region name
```
```yaml {% srNumber=3 %}
        databaseName: my_database_name
```
```yaml {% srNumber=4 %}
      ownershipProperty: custom_owner_property
```

{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}
### This is a sample config for Iceberg using a DynamoDB Catalog:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

* **name**: Enter the catalog name of choice.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

* **tableName**: Enter the name of the table where the Iceberg Catalog is stored.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

* **awsAccessKeyId**: Enter your secure access key ID for your AWS connection.
* **awsSecretAccessKey**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
* **awsSessionToken (optional)**: Enter the Session Access Token (used if using short lived credentials).
* **awsRegion**: Specify the AWS region used.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

* **databaseName (optional)**: Enter the database name of choice. If not it will be set as 'default'.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

* **ownershipProperty (optional)**: Property to use when searching for the owner. It defaults to 'owner'.

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: iceberg
  serviceName: glue_test
  serviceConnection:
    config:
      type: Iceberg
      catalog:
```
```yaml {% srNumber=1 %}
        name: my_dynamo
```
```yaml
        connection:
```
```yaml {% srNumber=2 %}
          tableName: catalog_table
```
```yaml {% srNumber=3 %}
          awsConfig:
            awsAccessKeyId: access key id
            awsSecretAccessKey: access secret key
            awsRegion: aws region name
```
```yaml {% srNumber=4 %}
        databaseName: my_database_name
```
```yaml {% srNumber=5 %}
      ownershipProperty: custom_owner_property
```

{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}
### This is a sample config for Iceberg using a Hive Catalog:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

* **name**: Enter the catalog name of choice.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

* **uri**: Enter the uri to the Hive Metastore. Example: 'thrift://localhost:9083'.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

* **fileSystem (Optional)**: Enter the specific configuration given the file system used to store the Iceberg files.
    * **Local**: No configuration needed
    * **S3 (Or S3 Compatible)**:
        * **awsAccessKeyId**: Enter your secure access key ID for your AWS connection.
        * **awsSecretAccessKey**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
        * **awsSessionToken (optional)**: Enter the Session Access Token (used if using short lived credentials).
        * **awsRegion**: Specify the AWS region used.
        * **endPointURL**: EndPoint URL to use with AWS.
    * **Azure**:
        * **clientId** : Client ID of the data storage account
        * **clientSecret** : Client Secret of the account
        * **tenantId** : Tenant ID under which the data storage account falls
        * **accountName** : Account Name of the data Storage

{% /codeInfo %}

{% codeInfo srNumber=4 %}

* **databaseName (optional)**: Enter the database name of choice. If not it will be set as 'default'.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

* **ownershipProperty (optional)**: Property to use when searching for the owner. It defaults to 'owner'.

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: iceberg
  serviceName: glue_test
  serviceConnection:
    config:
      type: Iceberg
      catalog:
```
```yaml {% srNumber=1 %}
        name: my_hive
```
```yaml
        connection:
```
```yaml {% srNumber=2 %}
          uri: thrift://localhost:9083
```
```yaml {% srNumber=3 %}
          fileSystem:
            # S3 Compatible
            awsAccessKeyId: access key id
            awsSecretAccessKey: access secret key
            awsRegion: aws region name

            # Azure
            # clientId: client_id
            # clientSecret: client_secret
            # tenantId: tenant_id
            # accountName: account_name
```
```yaml {% srNumber=4 %}
        databaseName: my_database_name
```
```yaml {% srNumber=5 %}
      ownershipProperty: custom_owner_property
```

{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

### This is a sample config for Iceberg using a REST Catalog:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

* **name**: Enter the catalog name of choice.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

* **uri**: Enter the uri to the Rest Catalog. Example: 'http://localhost:8181'.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

* **credential (Optional)**: OAuth2 Credential to use for Authentication flow.
    * **clientId**: OAuth2 Client ID.
    * **clientSecret**: OAuth2 Client Secret.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

* **token (Optional)**: Enter the Bearer token for the 'Authorization' header.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

* **ssl (Optional)**: Needed configuration for SSL.
    * **caCertPath**: CA Certificate Path.
    * **clientCertPath**: Client Certificate Path.
    * **privateKeyPath**: Private Key Path.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

* **sigv4 (Optional)**: Used if signing requests using AWS SigV4 protocol.
    * **signingRegion** : AWS Region used when signing a request.
    * **signingName** : Name used to sign the request with.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

* **fileSystem (Optional)**: Enter the specific configuration given the file system used to store the Iceberg files.
    * **Local**: No configuration needed
    * **S3 (Or S3 Compatible)**:
        * **awsAccessKeyId**: Enter your secure access key ID for your AWS connection.
        * **awsSecretAccessKey**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
        * **awsSessionToken (optional)**: Enter the Session Access Token (used if using short lived credentials).
        * **awsRegion**: Specify the AWS region used.
        * **endPointURL**: EndPoint URL to use with AWS.
    * **Azure**:
        * **clientId** : Client ID of the data storage account
        * **clientSecret** : Client Secret of the account
        * **tenantId** : Tenant ID under which the data storage account falls
        * **accountName** : Account Name of the data Storage

{% /codeInfo %}

{% codeInfo srNumber=8 %}

* **databaseName (optional)**: Enter the database name of choice. If not it will be set as 'default'.

{% /codeInfo %}

{% codeInfo srNumber=9 %}

* **warehouseLocation (optional)**: Warehouse Location. Used to specify a custom warehouse location if needed.

Most Catalogs should have a working default warehouse location.

{% /codeInfo %}

{% codeInfo srNumber=10 %}

* **ownershipProperty (optional)**: Property to use when searching for the owner. It defaults to 'owner'.

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: iceberg
  serviceName: glue_test
  serviceConnection:
    config:
      type: Iceberg
      catalog:
```
```yaml {% srNumber=1 %}
        name: my_rest
```
```yaml
        connection:
```
```yaml {% srNumber=2 %}
          uri: http://localhost:8181
```
```yaml {% srNumber=3 %}
          credential:
            clientId: client_id
            clientSecret: client_secret
```
```yaml {% srNumber=4 %}
          token: my_bearer_token
```
```yaml {% srNumber=5 %}
          ssl:
            caCertPath: ./ca_cert.pem
            clientCertPath: ./client_cert.crt
            privateKeyPath: ./private.key
```
```yaml {% srNumber=6 %}
          sigv4:
            signingRegion: us-east-2
            signingName: signing_name
```
```yaml {% srNumber=7 %}
          fileSystem:
            # S3 compatible
            awsAccessKeyId: access key id
            awsSecretAccessKey: access secret key
            awsRegion: aws region name

            # Azure
            # clientId: client_id
            # clientSecret: client_secret
            # tenantId: tenant_id
            # accountName: account_name
```
```yaml {% srNumber=8 %}
        databaseName: my_database_name
```
```yaml {% srNumber=9 %}
        warehouseLocation: warehouse_location
```
```yaml {% srNumber=10 %}
      ownershipProperty: custom_owner_property
```

{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
