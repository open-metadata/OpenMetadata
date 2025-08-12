---
title: Run the OpenSearch Connector Externally
description: Use YAML to configure OpenSearch ingestion and enable search index metadata extraction and lineage tracking.
slug: /connectors/search/opensearch/yaml
---

{% connectorDetailsHeader
name="OpenSearch"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Search Indexes", "Sample Data"]
unavailableFeatures=[]
/ %}

In this section, we provide guides and references to use the OpenSearch connector.

Configure and schedule OpenSearch metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.10/connectors/external-ingestion-deployment.md" /%}

## Requirements

We extract OpenSearch's metadata by using its [API](https://opensearch.org/docs/latest/api-reference/). To run this ingestion, you just need a user with permissions to the OpenSearch instance.

### Python Requirements

{% partial file="/v1.10/connectors/python-requirements.md" /%}

To run the OpenSearch ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[opensearch]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/search/openSearchConnection.json)
you can find the structure to create a connection to OpenSearch.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for OpenSearch:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: This parameter specifies the host and port of the OpenSearch instance. This should be specified as a URI string in the format `http://hostname:port` or `https://hostname:port`. For example, you might set it to `https://localhost:9200`.

{% /codeInfo %}


{% codeInfo srNumber=2 %}
**Basic Authentication**

- **username**: Username to connect to OpenSearch required when Basic Authentication is enabled on OpenSearch.
- **password**: Password of the user account to connect with OpenSearch.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**IAM BASED Auth**

- **awsAccessKeyId** & **awsSecretAccessKey**: When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have
  permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and
  authorize your requests ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html)).

  Access keys consist of two parts: An **access key ID** (for example, `AKIAIOSFODNN7EXAMPLE`), and a **secret access key** (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

  You must use both the access key ID and secret access key together to authenticate your requests.

  You can find further information on how to manage your access keys [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html).

- **awsSessionToken**: If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID
and AWS Secrets Access Key. Also, these will include an AWS Session Token.


- **awsRegion**: Each AWS Region is a separate geographic area in which AWS clusters data centers ([docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

  As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

  Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the
  services programmatically, there are different ways in which we can extract and use the rest of AWS configurations.

  You can find further information about configuring your credentials [here](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).


- **endPointURL**: To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the
entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the
default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

  Find more information on [AWS service endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html).


- **profileName**: A named profile is a collection of settings and credentials that you can apply to a AWS CLI command.
When you specify a profile to run a command, the settings and credentials are used to run that command.
Multiple named profiles can be stored in the config and credentials files.

  You can inform this field if you'd like to use a profile other than `default`.

  Find here more information about [Named profiles for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).


- **assumeRoleArn**: Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the
`ARN` (Amazon Resource Name) of the policy of the other account.

  A user who wants to access a role in a different account must also have permissions that are delegated from the account
  administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

  This is a required field if you'd like to `AssumeRole`.

  Find more information on [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html).

- **assumeRoleSessionName**: An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role
is assumed by different principals or for different reasons.

  By default, we'll use the name `OpenMetadataSession`.

  Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).


- **assumeRoleSourceIdentity**: The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity
information in AWS CloudTrail logs to determine who took actions with a role.

  Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).

{% /codeInfo %}

{% codeInfo srNumber=4 %}

- **verifySSL**: Whether SSL verification should be perform when authenticating.

{% /codeInfo %}

{% codeInfo srNumber=5 %}
- **sslConfig**:
    1. SSL Certificates By Path
    - caCertPath: This field specifies the path of CA certificate required for authentication.
    - clientCertPath: This field specifies the path of Clint certificate required for authentication.
    - privateKeyPath: This field specifies the path of Clint Key/Private Key required for authentication.
    
    2. SSL Certificates By Value
    - caCertValue: This field specifies the value of CA certificate required for authentication.
    - clientCertValue: This field specifies the value of Clint certificate required for authentication.
    - privateKeyValue: This field specifies the value of Clint Key/Private Key required for authentication.
    - stagingDir: This field specifies the path to temporary staging directory, where the certificates will be stored temporarily during the ingestion process, which will de deleted once the ingestion job is over.
    - when you are using this approach make sure you are passing the key in a correct format. If your certificate looks like this:
    ```
    -----BEGIN CERTIFICATE-----
    MII..
    MBQ...
    CgU..
    8Lt..
    ...
    h+4=
    -----END CERTIFICATE-----
    ```

    You will have to replace new lines with `\n` and the final value that you need to pass should look like this:

    ```
    -----BEGIN CERTIFICATE-----\nMII..\nMBQ...\nCgU..\n8Lt..\n...\nh+4=\n-----END CERTIFICATE-----\n

{% /codeInfo %}


{% codeInfo srNumber=6 %}
- **connectionTimeoutSecs**: Connection timeout configuration for communicating with OpenSearch APIs.
{% /codeInfo %}

{% partial file="/v1.10/connectors/yaml/search/source-config-def.md" /%}

{% partial file="/v1.10/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.10/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: opensearch
  serviceName: opensearch_source
  serviceConnection:
    config:
      type: OpenSearch
```
```yaml {% srNumber=1 %}
      hostPort: http://localhost:9200
```
```yaml {% srNumber=2 %}
      authType:
        username: open
        password: my_own_password
```
```yaml {% srNumber=3 %}
        # awsConfig:
        #       awsAccessKeyId: access key id
        #       awsSecretAccessKey: access secret key
        #       awsRegion: aws region name
        #       awsSessionToken: Token
```
```yaml {% srNumber=4 %}
      verifySSL: no-ssl
```
```yaml {% srNumber=5 %}
      sslConfig:
        certificates:
          caCertPath: /path/to/http_ca.crt
          clientCertPath: /path/to/http_ca.crt
          privateKeyPath: /path/to/http_ca.crt

          # pass certificate values
          # caCertValue: -----BEGIN CERTIFICATE-----\n....\n.....\n-----END CERTIFICATE-----\n
          # clientCertValue: -----BEGIN CERTIFICATE-----\n....\n...-----END CERTIFICATE-----\n
          # privateKeyValue: -----BEGIN RSA PRIVATE KEY-----\n....\n....\n-----END RSA PRIVATE KEY-----\n
          # stagingDir: /tmp/stage
```
```yaml {% srNumber=6 %}
      connectionTimeoutSecs: 30
```

{% partial file="/v1.10/connectors/yaml/search/source-config.md" /%}

{% partial file="/v1.10/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.10/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.10/connectors/yaml/ingestion-cli.md" /%}
