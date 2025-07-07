---
title: Greenplum Connector | OpenMetadata Database Integration Guide
description: Connect Greenplum to OpenMetadata with our comprehensive database connector guide. Setup instructions, configuration details, and metadata extraction made simple.
slug: /connectors/database/greenplum
---

{% connectorDetailsHeader
name="Greenplum"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "dbt", "View Lineage", "Sample Data"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures", "Lineage", "Column-level Lineage"]
/ %}

In this section, we provide guides and references to use the Greenplum connector.

Configure and schedule Greenplum metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](/connectors/ingestion/workflows/usage)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [Lineage](/how-to-guides/data-lineage/workflow)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Enable Security](#securing-greenplum-connection-with-ssl-in-openmetadata)
- [Troubleshooting](/connectors/database/greenplum/troubleshooting)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/greenplum/yaml"} /%}

## Requirements

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Greenplum", 
    selectServicePath: "/images/v1.7/connectors/greenplum/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/greenplum/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/greenplum/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to Greenplum. It should have enough privileges to read all the metadata.
- **Auth Type**: Basic Auth or IAM based auth to connect to instances / cloud rds.
  - **Basic Auth**: 
    - **Password**: Password to connect to Greenplum
  - **IAM Based Auth**: 
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

    {%note%}
    When using Assume Role authentication, ensure you provide the following details:  
    - **AWS Region**: Specify the AWS region for your deployment.  
    - **Assume Role ARN**: Provide the ARN of the role in your AWS account that OpenMetadata will assume.  
    {%/note%}

    - **Assume Role Session Name**: An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role
      is assumed by different principals or for different reasons.

    By default, we'll use the name `OpenMetadataSession`.

    Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).

    - **Assume Role Source Identity**: The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity
      information in AWS CloudTrail logs to determine who took actions with a role.

    Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).
- **Host and Port**: Enter the fully qualified hostname and port number for your Greenplum deployment in the Host and Port field.


**SSL Modes**

There are a couple of types of SSL modes that Greenplum supports which can be added to ConnectionArguments, they are as follows:
- **disable**: SSL is disabled and the connection is not encrypted.
- **allow**: SSL is used if the server requires it.
- **prefer**: SSL is used if the server supports it.
- **require**: SSL is required.
- **verify-ca**: SSL must be used and the server certificate must be verified.
- **verify-full**: SSL must be used. The server certificate must be verified, and the server hostname must match the hostname attribute on the certificate.

**SSL Configuration**

In order to integrate SSL in the Metadata Ingestion Config, the user will have to add the SSL config under sslConfig which is placed in the source.

{% partial file="/v1.7/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Securing Greenplum Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and a Greenplum database, you can configure SSL using different SSL modes provided by Greenplum, each offering varying levels of security.

Under `Advanced Config`, specify the SSL mode appropriate for your connection, such as `prefer`, `verify-ca`, `allow`, and others. After selecting the SSL mode, provide the CA certificate used for SSL validation (`caCertificate`). Note that Greenplum requires only the CA certificate for SSL validation.

{% note %}

For IAM authentication, it is recommended to choose the `allow` mode or another SSL mode that fits your specific requirements.

{% /note %}

{% image
  src="/images/v1.7/connectors/ssl_connection.png"
  alt="SSL Configuration"
  height="450px"
  caption="SSL Configuration" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}
