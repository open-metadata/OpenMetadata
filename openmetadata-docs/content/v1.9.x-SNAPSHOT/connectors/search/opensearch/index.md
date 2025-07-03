---
title: OpenSearch Connector | OpenMetadata Search Integration
description: Connect OpenMetadata to OpenSearch with our comprehensive connector guide. Setup instructions, configuration options, and troubleshooting tips included.
slug: /connectors/search/opensearch
---

{% connectorDetailsHeader
name="OpenSearch"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Search Indexes", "Sample Data"]
unavailableFeatures=[]
/ %}


In this section, we provide guides and references to use the OpenSearch connector.

Configure and schedule OpenSearch metadata workflow from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Troubleshooting](/connectors/search/opensearch/troubleshooting)

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/search/opensearch/yaml"} /%}

## Requirements

We extract OpenSearch's metadata by using its [API](https://opensearch.org/docs/latest/api-reference/). To run this ingestion, you just need a user with permissions to the OpenSearch instance.


## Metadata Ingestion

{% partial 
  file="/v1.9/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "OpenSearch", 
    selectServicePath: "/images/v1.9/connectors/opensearch/select-service.png",
    addNewServicePath: "/images/v1.9/connectors/opensearch/add-new-service.png",
    serviceConnectionPath: "/images/v1.9/connectors/opensearch/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: This parameter specifies the host and port of the OpenSearch instance. This should be specified as a URI string in the format `http://hostname:port` or `https://hostname:port`. For example, you might set it to `https://localhost:9200`.
- **Authentication Types**:
    1. Basic Authentication
    - Username: Username to connect to OpenSearch required when Basic Authentication is enabled on OpenSearch.
    - Password: Password of the user account to connect with OpenSearch.
    2. IAM based Authentication
    - **AWS Access Key ID** & **AWS Secret Access Key**: When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have
    permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and
    authorize your requests ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html)).

        Access keys consist of two parts: An **access key ID** (for example, `AKIAIOSFODNN7EXAMPLE`), and a **secret access key** (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

        You must use both the access key ID and secret access key together to authenticate your requests.

        You can find further information on how to manage your access keys [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html).

    - **AWS Region**: Each AWS Region is a separate geographic area in which AWS clusters data centers ([docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

        As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

        Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the
        services programmatically, there are different ways in which we can extract and use the rest of AWS configurations.

        You can find further information about configuring your credentials [here](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).

    - **AWS Session Token (optional)**: If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID
    and AWS Secrets Access Key. Also, these will include an AWS Session Token.

        You can find more information on [Using temporary credentials with AWS resources](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html).

    - **Endpoint URL (optional)**: To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the
    entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the
    default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

        Find more information on [AWS service endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html).

    - **Profile Name**: A named profile is a collection of settings and credentials that you can apply to a AWS CLI command.
    When you specify a profile to run a command, the settings and credentials are used to run that command.
    Multiple named profiles can be stored in the config and credentials files.

        You can inform this field if you'd like to use a profile other than `default`.

        Find here more information about [Named profiles for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).

    - **Assume Role Arn**: Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the
    `ARN` (Amazon Resource Name) of the policy of the other account.

        A user who wants to access a role in a different account must also have permissions that are delegated from the account
        administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

        This is a required field if you'd like to `AssumeRole`.

        Find more information on [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html).

    - **Assume Role Session Name**: An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role
    is assumed by different principals or for different reasons.

        By default, we'll use the name `OpenMetadataSession`.

        Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).

    - **Assume Role Source Identity**: The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity
    information in AWS CloudTrail logs to determine who took actions with a role.

        Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).

- **Verify SSL**:
Client SSL verification. Make sure to configure the SSLConfig if enabled.
Possible values:
  * `validate`: Validate the certificate using the public certificate (recommended).
  * `ignore`: Ignore the certification validation (not recommended for production).
  * `no-ssl`: SSL validation is not needed.

- **SSL Certificates**:
    1. SSL Certificates By Path
    - CA Certificate Path: This field specifies the path of CA certificate required for authentication.
    - Client Certificate Path: This field specifies the path of Clint certificate required for authentication.
    - Private Key Path: This field specifies the path of Clint Key/Private Key required for authentication.
    
    2. SSL Certificates By Value
    - CA Certificate Value: This field specifies the value of CA certificate required for authentication.
    - Client Certificate Value: This field specifies the value of Clint certificate required for authentication.
    - Private Key Value: This field specifies the value of Clint Key/Private Key required for authentication.
    - Staging Directory Path: This field specifies the path to temporary staging directory, where the certificates will be stored temporarily during the ingestion process, which will de deleted once the ingestion job is over.
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

- **Connection Timeout in Seconds**: Connection timeout configuration for communicating with OpenSearch APIs.

{% /extraContent %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/search/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
