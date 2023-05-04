---
title: Run QuickSight Connector using the CLI
slug: /connectors/dashboard/quicksight/cli
---

# Run QuickSight using the metadata CLI

| Stage      | PROD                         |
|------------|------------------------------|
| Dashboards | {% icon iconName="check" /%} |
| Charts     | {% icon iconName="check" /%} |
| Owners     | {% icon iconName="cross" /%} |
| Tags       | {% icon iconName="cross" /%} |
| Datamodels | {% icon iconName="cross" /%} |
| Lineage    | {% icon iconName="check" /%} |

In this section, we provide guides and references to use the QuickSight connector.

Configure and schedule QuickSight metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

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


To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

### Python Requirements

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

```yaml
source:
  type: QuickSight
  serviceName: local_QuickSight
  serviceConnection:
    config:
      type: QuickSight
      awsConfig:
        awsAccessKeyId: key
        awsSecretAccessKey: secret
        awsRegion: ap-south-1
        awsSessionToken: token
      awsAccountId: account-id
      identityType: identityType
  sourceConfig:
    config:
      type: DashboardMetadata
      includeOwner: True
      markDeletedDashboards: True
      includeTags: True
      # dbServiceNames:
      #   - service1
      #   - service2
      # dashboardFilterPattern:
      #   includes:
      #     - dashboard1
      #     - dashboard2
      #   excludes:
      #     - dashboard3
      #     - dashboard4
      # chartFilterPattern:
      #   includes:
      #     - chart1
      #     - chart2
      #   excludes:
      #     - chart3
      #     - chart4
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  # loggerLevel: DEBUG  # DEBUG, INFO, WARN or ERROR
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

#### Source Configuration - Service Connection

- **awsConfig**
  - **AWS Access Key ID**: Enter your secure access key ID for your Glue connection. The specified key ID should be authorized to read all databases you want to include in the metadata ingestion workflow.
  - **AWS Secret Access Key**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
  - **AWS Region**: Enter the location of the amazon cluster that your data and account are associated with.
  - **AWS Session Token (optional)**: The AWS session token is an optional parameter. If you want, enter the details of your temporary session token.
  - **Endpoint URL (optional)**: Your Glue connector will automatically determine the AWS QuickSight endpoint URL based on the region. You may override this behavior by entering a value to the endpoint URL.

- **identityType**: The authentication method that the user uses to sign in.
- **awsAccountId**: QuickSight account ID is required to manage QuickSight users, data sources, and reports.
- **namespace**: The Amazon QuickSight namespace that contains the dashboard IDs in this request ( To be provided when identityType is `ANONYMOUS` )
#### Source Configuration - Source Config

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/dashboardServiceMetadataPipeline.json):

- `dbServiceNames`: Database Service Name for the creation of lineage, if the source supports it.
- `dashboardFilterPattern` / `chartFilterPattern`: Note that all of them support regex as include or exclude. E.g., "My dashboard, My dash.*, .*Dashboard".
- `includeTags`: Set the 'Include Tags' toggle to control whether to include tags as part of metadata ingestion.
- `markDeletedDashboards`: Set the Mark Deleted Dashboards toggle to flag dashboards as soft-deleted if they are not present anymore in the source system.

```yaml
dashboardFilterPattern:
  includes:
    - users
    - type_test
```

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: openmetadata
    securityConfig:
      jwtToken: '{bot_jwt_token}'
```

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/security/client).
You can find the different implementation of the ingestion below.

<Collapse title="Configure SSO in the Ingestion Workflows">

### Openmetadata JWT Auth

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: openmetadata
    securityConfig:
      jwtToken: '{bot_jwt_token}'
```

### Auth0 SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: auth0
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

### Azure SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: azure
    securityConfig:
      clientSecret: '{your_client_secret}'
      authority: '{your_authority_url}'
      clientId: '{your_client_id}'
      scopes:
        - your_scopes
```

### Custom OIDC SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: custom-oidc
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

### Google SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: google
    securityConfig:
      secretKey: '{path-to-json-creds}'
```

### Okta SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: okta
    securityConfig:
      clientId: "{CLIENT_ID - SPA APP}"
      orgURL: "{ISSUER_URL}/v1/token"
      privateKey: "{public/private keypair}"
      email: "{email}"
      scopes:
        - token
```

### Amazon Cognito SSO

The ingestion can be configured by [Enabling JWT Tokens](https://docs.open-metadata.org/deployment/security/enable-jwt-tokens)

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: auth0
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

### OneLogin SSO

Which uses Custom OIDC for the ingestion

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: custom-oidc
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

### KeyCloak SSO

Which uses Custom OIDC for the ingestion

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: custom-oidc
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

</Collapse>


### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```bash
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration,
you will be able to extract metadata from different sources.

