---
title: Run the Datalake Connector Externally
slug: /connectors/database/datalake/yaml
---

{% connectorDetailsHeader
name="Datalake"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality"]
unavailableFeatures=["Query Usage", "Lineage", "Column-level Lineage", "Owners", "dbt", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Datalake connector.

Configure and schedule Datalake metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

**Note:** Datalake connector supports extracting metadata from file types `JSON`, `CSV`, `TSV` & `Parquet`.


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

### ADLS Permissions

To extract metadata from Azure ADLS (Storage Account - StorageV2), you will need an **App Registration** with the following
permissions on the Storage Account:
- Storage Blob Data Contributor
- Storage Queue Data Contributor

### Python Requirements

If running OpenMetadata version greater than 0.13, you will need to install the Datalake ingestion for GCS or S3:

#### S3 installation

```bash
pip3 install "openmetadata-ingestion[datalake-s3]"
```

#### GCS installation

```bash
pip3 install "openmetadata-ingestion[datalake-gcp]"
```

#### Azure installation

```bash
pip3 install "openmetadata-ingestion[datalake-azure]"
```

#### If version <0.13

You will be installing the requirements together for S3 and GCS

```bash
pip3 install "openmetadata-ingestion[datalake]"
```

## Metadata Ingestion
All connectors are defined as JSON Schemas. Here you can find the structure to create a connection to Datalake.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a YAML configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following JSON Schema.

## 1. Define the YAML Config

#### Source Configuration - Source Config using AWS S3

### This is a sample config for Datalake using AWS S3:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

* **awsAccessKeyId**: Enter your secure access key ID for your DynamoDB connection. The specified key ID should be authorized to read all databases you want to include in the metadata ingestion workflow.
* **awsSecretAccessKey**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
* **awsRegion**: Specify the region in which your DynamoDB is located. This setting is required even if you have configured a local AWS profile.
* **schemaFilterPattern** and **tableFilterPattern**: Note that the `schemaFilterPattern` and `tableFilterPattern` both support regex as `include` or `exclude`. E.g.,

{% /codeInfo %}


{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: datalake
  serviceName: local_datalake
  serviceConnection:
    config:
      type: Datalake
```

```yaml {% srNumber=1 %}
      configSource:      
        securityConfig: 
          awsAccessKeyId: aws access key id
          awsSecretAccessKey: aws secret access key
          awsRegion: aws region
      bucketName: bucket name
      prefix: prefix
```

{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}


### This is a sample config for Datalake using GCS:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=5 %}

* **type**: Credentials type, e.g. `service_account`.
* **projectId**
* **privateKey**
* **privateKeyId**
* **clientEmail**
* **clientId**
* **authUri**: [https://accounts.google.com/o/oauth2/auth](https://accounts.google.com/o/oauth2/auth) by default
* **tokenUri**: [https://oauth2.googleapis.com/token](https://oauth2.googleapis.com/token) by default
* **authProviderX509CertUrl**: [https://www.googleapis.com/oauth2/v1/certs](https://www.googleapis.com/oauth2/v1/certs) by default
* **clientX509CertUrl**
* **bucketName**: name of the bucket in GCS
* **Prefix**: prefix in gcp bucket

{% /codeInfo %}


{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: datalake
  serviceName: local_datalake
  serviceConnection:
    config:
      type: Datalake
      configSource:
        securityConfig:
```
```yaml {% srNumber=5 %}
          gcpConfig:
            type: type of account
            projectId: project id
            privateKeyId: private key id
            privateKey: private key
            clientEmail: client email
            clientId: client id
            authUri: https://accounts.google.com/o/oauth2/auth
            tokenUri: https://oauth2.googleapis.com/token
            authProviderX509CertUrl: https://www.googleapis.com/oauth2/v1/certs
            clientX509CertUrl:  clientX509 Certificate Url
      bucketName: bucket name
      prefix: prefix
```

{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

### This is a sample config for Datalake using Azure:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=9 %}

- **Client ID** : Client ID of the data storage account
- **Client Secret** : Client Secret of the account
- **Tenant ID** : Tenant ID under which the data storage account falls
- **Account Name** : Account Name of the data Storage

{% /codeInfo %}


{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
# Datalake with Azure 
source:
  type: datalake
  serviceName: local_datalake
  serviceConnection:
    config:
      type: Datalake
      configSource:    
```
```yaml {% srNumber=9 %}  
        securityConfig: 
          clientId: client-id
          clientSecret: client-secret
          tenantId: tenant-id
          accountName: account-name
      prefix: prefix
```

{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}

## dbt Integration

You can learn more about how to ingest dbt models' definitions and their lineage [here](/connectors/ingestion/workflows/dbt).
