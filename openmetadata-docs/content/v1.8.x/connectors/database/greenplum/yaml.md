---
title: Run the Greenplum Connector Externally
description: Use YAML to ingest Greenplum database metadata including profiling and schema lineage.
slug: /connectors/database/greenplum/yaml
---

{% connectorDetailsHeader
name="Greenplum"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "dbt", "view Lineage", "Sample Data", "Auto-Classification"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures", "Lineage", "Column-level Lineage"]
/ %}

In this section, we provide guides and references to use the Greenplum connector.

Configure and schedule Greenplum metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [Lineage](#lineage)
- [Enable Security](#securing-greenplum-connection-with-ssl-in-openmetadata)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

To run the Greenplum ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[postgres]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/greenplumConnection.json)
you can find the structure to create a connection to Greenplum.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Greenplum:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to Greenplum. It should have enough privileges to read all the metadata.

{% /codeInfo %}
{% codeInfo srNumber=2 %}

**authType**: Choose from basic auth and IAM based auth.
#### Basic Auth

**password**: Password comes under Basic Auth type.

{% /codeInfo %}

{% codeInfo srNumber=3 %}
#### IAM BASED Auth

- **awsAccessKeyId** & **awsSecretAccessKey**: When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have
  permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and
  authorize your requests ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html)).

Access keys consist of two parts: An **access key ID** (for example, `AKIAIOSFODNN7EXAMPLE`), and a **secret access key** (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

You must use both the access key ID and secret access key together to authenticate your requests.

You can find further information on how to manage your access keys [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html).

**awsSessionToken**: If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID
and AWS Secrets Access Key. Also, these will include an AWS Session Token.


**awsRegion**: Each AWS Region is a separate geographic area in which AWS clusters data centers ([docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the
services programmatically, there are different ways in which we can extract and use the rest of AWS configurations.

You can find further information about configuring your credentials [here](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).


**endPointURL**: To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the
entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the
default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on [AWS service endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html).


**profileName**: A named profile is a collection of settings and credentials that you can apply to a AWS CLI command.
When you specify a profile to run a command, the settings and credentials are used to run that command.
Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about [Named profiles for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).


**assumeRoleArn**: Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the
`ARN` (Amazon Resource Name) of the policy of the other account.

A user who wants to access a role in a different account must also have permissions that are delegated from the account
administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html).

{%note%}
When using Assume Role authentication, ensure you provide the following details:  
- **AWS Region**: Specify the AWS region for your deployment.  
- **Assume Role ARN**: Provide the ARN of the role in your AWS account that OpenMetadata will assume.  
{%/note%}

**assumeRoleSessionName**: An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role
is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).


**assumeRoleSourceIdentity**: The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity
information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).

{% /codeInfo %}

{% codeInfo srNumber=4 %}


**hostPort**: Enter the fully qualified hostname and port number for your Greenplum deployment in the Host and Port field.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**database**: Initial Greenplum database to connect to. If you want to ingest all databases, set ingestAllDatabases to true.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**ingestAllDatabases**: Ingest data from all databases in Greenplum. You can use databaseFilterPattern on top of this.

{% /codeInfo %}

{% partial file="/v1.8/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=7 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to database during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% codeInfo srNumber=9 %}

The sslConfig and sslMode are used to configure the SSL (Secure Sockets Layer) connection between your application and the Greenplum server. Greenplum will require only rootCertificate i.e caCertificate.

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

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: greenplum
  serviceName: local_greenplum
  serviceConnection:
    config:
      type: Greenplum
```
```yaml {% srNumber=1 %}
      username: username
```
```yaml {% srNumber=2 %}
      authType: 
            password: <password>
```
```yaml {% srNumber=3 %}
      authType: 
            awsConfig:
                  awsAccessKeyId: access key id
                  awsSecretAccessKey: access secret key
                  awsRegion: aws region name
```
```yaml {% srNumber=4 %}
      hostPort: localhost:5432
```
```yaml {% srNumber=5 %}
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

{% partial file="/v1.8/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}

{% partial file="/v1.8/connectors/yaml/data-profiler.md" variables={connector: "greenplum"} /%}

{% partial file="/v1.8/connectors/yaml/auto-classification.md" variables={connector: "greenplum"} /%}

{% partial file="/v1.8/connectors/yaml/data-quality.md" /%}

## Securing Greenplum Connection with SSL in OpenMetadata

To configure SSL for secure connections between OpenMetadata and a Greenplum database, Greenplum offers various SSL modes, each providing different levels of connection security.

When running the ingestion process externally, specify the SSL mode to be used for the Greenplum connection, such as `prefer`, `verify-ca`, `allow`, and others. Once you've chosen the SSL mode, provide the CA certificate for SSL validation (`caCertificate`). Only the CA certificate is required for SSL validation in Greenplum.

{% note %}

For IAM authentication, it is recommended to select the `allow` mode or another SSL mode that aligns with your specific needs.

{% /note %}

```yaml
      sslMode: disable #allow prefer require verify-ca verify-full
      sslConfig:
            caCertificate: "/path/to/ca/certificate" 
```

{% partial file="/v1.8/connectors/yaml/lineage.md" variables={connector: "greenplum"} /%}

## dbt Integration

You can learn more about how to ingest dbt models' definitions and their lineage [here](/connectors/ingestion/workflows/dbt).
