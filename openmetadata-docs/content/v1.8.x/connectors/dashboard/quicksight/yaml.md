---
title: Run the QuickSight Connector Externally
description: Configure AWS QuickSight connector in OpenMetadata using YAML. Step-by-step setup guide for dashboard metadata ingestion and integration.
slug: /connectors/dashboard/quicksight/yaml
---

{% connectorDetailsHeader
  name="QuickSight"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=["Dashboards", "Charts", "Lineage", "Datamodels"]
  unavailableFeatures=["Owners", "Tags", "Projects"]  
/ %}

In this section, we provide guides and references to use the QuickSight connector.

Configure and schedule QuickSight metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

AWS QuickSight Permissions
To execute metadata extraction and usage workflow successfully the IAM User should have enough access to fetch required data. Following table describes the minimum required permissions

| # | AWS QuickSight Permission |
| :---------- | :---------- |
| 1 | DescribeDashboard |
| 2 | ListAnalyses |
| 3 | ListDataSources |
| 4 | ListDashboards |
| 5 | DescribeAnalysis |
| 6 | DescribeDataSet |
| 7 | ListDataSets |
| 8 | DescribeDataSource |

Here is how to add Permissions to an IAM user.

- Navigate to the IAM console in the AWS Management Console.

- Choose the IAM user or group to which you want to attach the policy, and click on the "Permissions" tab.

- Click on the "Add permissions" button and select "Attach existing policies directly".

- Search for the policy by name or by filtering the available policies, and select the one you want to attach.

- Review the policy and click on "Add permissions" to complete the process.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "quicksight:DescribeDashboard",
                "quicksight:ListAnalyses",
                "quicksight:ListDataSources",
                "quicksight:ListDashboards",
                "quicksight:DescribeAnalysis",
                "quicksight:DescribeDataSet",
                "quicksight:ListDataSets",
                "quicksight:DescribeDataSource"
            ],
            "Resource": "*"
        }
    ]
}
```

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

To run the QuickSight ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[quicksight]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/quickSightConnection.json)
you can find the structure to create a connection to QuickSight.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is QuickSightled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for QuickSight:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% partial file="/v1.8/connectors/yaml/common/aws-config-def.md" /%}

{% codeInfo srNumber=2 %}

**awsAccountId**: AWS Account ID

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**identityType**: The authentication method that the user uses to sign in.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**namespace**: The Amazon QuickSight namespace that contains the dashboard IDs in this request ( To be provided when identityType is `ANONYMOUS` )

{% /codeInfo %}

{% partial file="/v1.8/connectors/yaml/dashboard/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: quicksight
  serviceName: local_quicksight
  serviceConnection:
    config:
      type: QuickSight
```

{% partial file="/v1.8/connectors/yaml/common/aws-config.md" /%}

```yaml {% srNumber=2 %}
      awsAccountId: <aws-account-id>
```
```yaml {% srNumber=3 %}
      identityType: IAM #QUICKSIGHT, ANONYMOUS
```
```yaml {% srNumber=4 %}
      namespace: #to be provided if identityType is Anonymous
```

{% partial file="/v1.8/connectors/yaml/dashboard/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}
