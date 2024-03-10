---
title: GCS
slug: /connectors/storage/gcs
---

{% connectorDetailsHeader
name="GCS"
stage="PROD"
platform="Collate"
availableFeatures=["Metadata"]
unavailableFeatures=[]
/ %}

This page contains the setup guide and reference information for the GCS connector.

Configure and schedule GCS metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/storage/gcs/yaml"} /%}

## Requirements

We need the following permissions in GCP:

### GCS Permissions

For all the buckets that we want to ingest, we need to provide the following:
- `GCS:ListBucket`
- `GCS:GetObject`
- `GCS:GetBucketLocation`
- `GCS:ListAllMyBuckets`

Note that the `Resources` should be all the buckets that you'd like to scan. A possible policy could be:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "GCS:GetObject",
                "GCS:ListBucket",
                "GCS:GetBucketLocation",
                "GCS:ListAllMyBuckets"
            ],
            "Resource": [
                "arn:GCP:GCS:::*"
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

### OpenMetadata Manifest

In any other connector, extracting metadata happens automatically. In this case, we will be able to extract high-level
metadata from buckets, but in order to understand their internal structure we need users to provide an `openmetadata.json`
file at the bucket root.

You can learn more about this [here](/connectors/storage). Keep reading for an example on the shape of the manifest file.

{% partial file="/v1.3/connectors/storage/manifest.md" /%}

## Metadata Ingestion

{% stepsContainer %}

{% step srNumber=1 %}

{% stepDescription title="1. Visit the Services Page" %}

The first step is ingesting the metadata from your sources. Under
Settings, you will find a Services link an external source system to
OpenMetadata. Once a service is created, it can be used to configure
metadata, usage, and profiler workflows.

To visit the Services page, select Services from the Settings menu.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.3/connectors/visit-services.png"
alt="Visit Services Page"
caption="Find Dashboard option on left panel of the settings page" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=2 %}

{% stepDescription title="2. Create a New Service" %}

Click on the 'Add New Service' button to start the Service creation.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.3/connectors/create-service.png"
alt="Create a new service"
caption="Add a new Service from the Storage Services page" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=3 %}

{% stepDescription title="3. Select the Service Type" %}

Select GCS as the service type and click Next.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.3/connectors/GCS/select-service.png"
  alt="Select Service"
  caption="Select your service from the list" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=4 %}

{% stepDescription title="4. Name and Describe your Service" %}

Provide a name and description for your service.

#### Service Name

OpenMetadata uniquely identifies services by their Service Name. Provide
a name that distinguishes your deployment from other services, including
the other Storage services that you might be ingesting metadata
from.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.3/connectors/GCS/add-new-service.png"
  alt="Add New Service"
  caption="Provide a Name and description for your Service" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=5 %}

{% stepDescription title="5. Configure the Service Connection" %}

In this step, we will configure the connection settings required for
this connector. Please follow the instructions below to ensure that
you've configured the connector to read from your GCS service as
desired.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.3/connectors/GCS/service-connection.png"
  alt="Configure service connection"
  caption="Configure the service connection by filling the form" /%}

{% /stepVisualInfo %}

{% /step %}

{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **GCP Access Key ID** & **GCP Secret Access Key**: When you interact with GCP, you specify your GCP security credentials to verify who you are and whether you have
  permission to access the resources that you are requesting. GCP uses the security credentials to authenticate and
  authorize your requests ([docs](https://docs.GCP.amazon.com/IAM/latest/UserGuide/security-creds.html)).

Access keys consist of two parts: An **access key ID** (for example, `AKIAIOSFODNN7EXAMPLE`), and a **secret access key** (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

You must use both the access key ID and secret access key together to authenticate your requests.

You can find further information on how to manage your access keys [here](https://docs.GCP.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html).

- **GCP Region**: Each GCP Region is a separate geographic area in which GCP clusters data centers ([docs](https://docs.GCP.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

As GCP can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the GCP Region is the only required parameter when configuring a connection. When connecting to the
services programmatically, there are different ways in which we can extract and use the rest of GCP configurations.

You can find further information about configuring your credentials [here](https://boto3.amazonGCP.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).

- **GCP Session Token (optional)**: If you are using temporary credentials to access your services, you will need to inform the GCP Access Key ID
  and GCP Secrets Access Key. Also, these will include an GCP Session Token.

You can find more information on [Using temporary credentials with GCP resources](https://docs.GCP.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html).

- **Endpoint URL (optional)**: To connect programmatically to an GCP service, you use an endpoint. An *endpoint* is the URL of the
  entry point for an GCP web service. The GCP SDKs and the GCP Command Line Interface (GCP CLI) automatically use the
  default endpoint for each service in an GCP Region. But you can specify an alternate endpoint for your API requests.

Find more information on [GCP service endpoints](https://docs.GCP.amazon.com/general/latest/gr/rande.html).

- **Profile Name**: A named profile is a collection of settings and credentials that you can apply to a GCP CLI command.
  When you specify a profile to run a command, the settings and credentials are used to run that command.
  Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about [Named profiles for the GCP CLI](https://docs.GCP.amazon.com/cli/latest/userguide/cli-configure-profiles.html).

- **Assume Role Arn**: Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the
`ARN` (Amazon Resource Name) of the policy of the other account.

A user who wants to access a role in a different account must also have permissions that are delegated from the account
administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on [AssumeRole](https://docs.GCP.amazon.com/STS/latest/APIReference/API_AssumeRole.html).

- **Assume Role Session Name**: An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role
is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the [Role Session Name](https://docs.GCP.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).

- **Assume Role Source Identity**: The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity
information in GCP CloudTrail logs to determine who took actions with a role.

Find more information about [Source Identity](https://docs.GCP.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/storage/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
