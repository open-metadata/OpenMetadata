---
title: Run the S3 Connector Externally
slug: /connectors/storage/s3/yaml
---

{% connectorDetailsHeader
name="S3"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=[]
/ %}

This page contains the setup guide and reference information for the S3 connector.

Configure and schedule S3 metadata workflows from the CLI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 1.0 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To run the metadata ingestion, we need the following permissions in AWS:

### S3 Permissions

For all the buckets that we want to ingest, we need to provide the following:
- `s3:ListBucket`
- `s3:GetObject`
- `s3:GetBucketLocation`
- `s3:ListAllMyBuckets`

Note that the `Resources` should be all the buckets that you'd like to scan. A possible policy could be:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket",
                "s3:GetBucketLocation",
                "s3:ListAllMyBuckets"
            ],
            "Resource": [
                "arn:aws:s3:::*"
            ]
        }
    ]
}
```

### CloudWatch Permissions

Which is used to fetch the total size in bytes for a bucket and the total number of files. It requires:
- `cloudwatch:GetMetricData`
- `cloudwatch:ListMetrics`

The policy would look like:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "cloudwatch:GetMetricData",
                "cloudwatch:ListMetrics"
            ],
            "Resource": "*"
        }
    ]
}
```

### Python Requirements

To run the Athena ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[athena]"
```

### OpenMetadata Manifest

In any other connector, extracting metadata happens automatically. In this case, we will be able to extract high-level
metadata from buckets, but in order to understand their internal structure we need users to provide an `openmetadata.json`
file at the bucket root.

You can learn more about this [here](/connectors/storage). Keep reading for an example on the shape of the manifest file.

{% partial file="/v1.3/connectors/storage/manifest.md" /%}

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/storage/s3Connection.json)
you can find the structure to create a connection to Athena.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Athena:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

- **awsAccessKeyId** & **awsSecretAccessKey**: When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have
  permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and
  authorize your requests ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html)).

Access keys consist of two parts: An **access key ID** (for example, `AKIAIOSFODNN7EXAMPLE`), and a **secret access key** (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

You must use both the access key ID and secret access key together to authenticate your requests.

You can find further information on how to manage your access keys [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html).

{% /codeInfo %}

{% codeInfo srNumber=2 %}
**awsSessionToken**: If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID
and AWS Secrets Access Key. Also, these will include an AWS Session Token.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**awsRegion**: Each AWS Region is a separate geographic area in which AWS clusters data centers ([docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the
services programmatically, there are different ways in which we can extract and use the rest of AWS configurations.

You can find further information about configuring your credentials [here](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**endPointURL**: To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the
entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the
default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on [AWS service endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html).

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**profileName**: A named profile is a collection of settings and credentials that you can apply to a AWS CLI command.
When you specify a profile to run a command, the settings and credentials are used to run that command.
Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about [Named profiles for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**assumeRoleArn**: Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the
`ARN` (Amazon Resource Name) of the policy of the other account.

A user who wants to access a role in a different account must also have permissions that are delegated from the account
administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html).
{% /codeInfo %}

{% codeInfo srNumber=7 %}

**assumeRoleSessionName**: An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role
is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**assumeRoleSourceIdentity**: The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity
information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/storage/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=11 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=12 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: s3
  serviceName: local_s3
  serviceConnection:
    config:
      type: S3
      awsConfig:
```
```yaml {% srNumber=1 %}
        awsAccessKeyId: KEY
        awsSecretAccessKey: SECRET
```
```yaml {% srNumber=2 %}
        # awsSessionToken: TOKEN
```
```yaml {% srNumber=3 %}
        awsRegion: us-east-2
```
```yaml {% srNumber=4 %}
        # endPointURL: https://s3.us-east-2.amazonaws.com/custom
```
```yaml {% srNumber=5 %}
        # profileName: profile
```
```yaml {% srNumber=6 %}
        # assumeRoleArn: "arn:partition:service:region:account:resource"
```
```yaml {% srNumber=7 %}
        # assumeRoleSessionName: session
```
```yaml {% srNumber=8 %}
        # assumeRoleSourceIdentity: identity
```
```yaml {% srNumber=11 %}
      # connectionOptions:
        # key: value
```
```yaml {% srNumber=12 %}
      # connectionArguments:
        # key: value
```

{% partial file="/v1.3/connectors/yaml/storage/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}



{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}

## Related

{% tilesContainer %}

{% tile
   icon="mediation"
   title="Configure Ingestion Externally"
   description="Deploy, configure, and manage the ingestion workflows externally."
   link="/deployment/ingestion"
 / %}

{% /tilesContainer %}
