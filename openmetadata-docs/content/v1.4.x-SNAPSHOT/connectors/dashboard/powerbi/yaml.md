---
title: Run the PowerBI Connector Externally
slug: /connectors/dashboard/powerbi/yaml
---

{% connectorDetailsHeader
  name="PowerBI"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=["Dashboards", "Charts", "Datamodels", "Projects", "Lineage"]
  unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the PowerBI connector.

Configure and schedule PowerBI metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

{% note noteType="Warning" %}
To access the PowerBI APIs and import dashboards, charts, and datasets from PowerBI into OpenMetadata, a `PowerBI Pro` license is necessary.
{% /note noteType="Warning" %}
{% /note %}

{% note %}
PowerBI dataflows are not yet supported.
{% /note %}

### PowerBI Admin and Non-Admin APIs:

While configuring the PowerBI ingestion you can choose whether to use the PowerBI Admin APIs to retrieve the metadata or use the PowerBI Non-Admin APIs. Please check below for the the difference in their functionality:
- Enabled (Use PowerBI Admin APIs)
Using the admin APIs will fetch the dashboard and chart metadata from all the workspaces available in the PowerBI instance.

{% note %} 

When using the PowerBI Admin APIs, the table and dataset information used to generate lineage is gathered using the PowerBI [Scan Result](https://learn.microsoft.com/en-us/rest/api/power-bi/admin/workspace-info-get-scan-result) API. This API has no limitations and hence does not restrict getting the necessary data for generating lineage.
{% /note %}

- Disabled (Use Non-Admin PowerBI APIs)
Using the non-admin APIs will only fetch the dashboard and chart metadata from the workspaces that have the security group of the service principal assigned to them.

{% note %} 

When using the PowerBI Non-Admin APIs, the table and dataset information used to generate lineage is gathered using the PowerBI [Get Dataset Tables](https://learn.microsoft.com/en-us/rest/api/power-bi/push-datasets/datasets-get-tables) API. This API only retrieves the table information if the dataset is a [Push Dataset](https://learn.microsoft.com/en-us/rest/api/power-bi/push-datasets).
Hence the lineage can only be created for push datasets in this case.

For more information please visit the PowerBI official documentation [here](https://learn.microsoft.com/en-us/rest/api/power-bi/push-datasets/datasets-get-tables#limitations).

{% /note %}

### PowerBI Account Setup
Follow the steps below to configure the account setup for PowerBI connector:
### Step 1: Enable API permissions from the PowerBI Admin console
We extract the information from PowerBI using APIs, this is a manual step a PowerBI Admin needs to do to ensure we can get the right information.

Login to the [Power BI](https://app.powerbi.com/) as Admin and from `Tenant` settings allow below permissions.
- Allow service principles to use Power BI APIs
- Allow service principals to use read-only Power BI admin APIs
- Enhance admin APIs responses with detailed metadata

### Step 2: Create the App in Azure AD
Please follow the steps mentioned [here](https://docs.microsoft.com/en-us/power-bi/developer/embedded/embed-service-principal) for setting up the Azure AD application service principle.

### Step 3: Provide necessary API permissions to the Azure AD app
Go to the `Azure Ad app registrations` page, select your app and add the dashboard permissions to the app for PowerBI service and grant admin consent for the same:

The required permissions are:
- `Dashboard.Read.All`

Optional Permissions: (Without granting these permissions, the dataset information cannot be retrieved and the datamodel and lineage processing will be skipped)
- `Dataset.Read.All`

{% note noteType="Warning" %}

Make sure that in the API permissions section **Tenant** related permissions are not being given to the app
Please refer [here](https://stackoverflow.com/questions/71001110/power-bi-rest-api-requests-not-authorizing-as-expected) for detailed explanation 

{% /note noteType="Warning" %}
{% /note %}

### Step 4: PowerBI Workspaces
The service principal does not take into account the default user workspaces e.g `My Workspace`.

Create new workspaces in PowerBI by following the document [here](https://docs.microsoft.com/en-us/power-bi/collaborate-share/service-create-the-new-workspaces)

For reference here is a [thread](https://community.powerbi.com/t5/Service/Error-while-executing-Get-dataset-call-quot-API-is-not/m-p/912360#M85711) referring to the same

### Python Requirements

To run the PowerBI ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[powerbi]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/powerBIConnection.json)
you can find the structure to create a connection to PowerBI.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for PowerBI:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**clientId**: PowerBI Client ID.

To get the client ID (also know as application ID), follow these steps:
- Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
- Search for App registrations and select the App registrations link.
- Select the Azure AD app you're using for embedding your Power BI content.
- From the Overview section, copy the Application (client) ID.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**clientSecret**: PowerBI Client Secret.

To get the client secret, follow these steps:
- Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
- Search for App registrations and select the App registrations link.
- Select the Azure AD app you're using for embedding your Power BI content.
- Under Manage, select Certificates & secrets.
- Under Client secrets, select New client secret.
- In the Add a client secret pop-up window, provide a description for your application secret, select when the application secret expires, and select Add.
- From the Client secrets section, copy the string in the Value column of the newly created application secret.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**tenantId**: PowerBI Tenant ID.

To get the tenant ID, follow these steps:
- Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
- Search for App registrations and select the App registrations link.
- Select the Azure AD app you're using for Power BI.
- From the Overview section, copy the Directory (tenant) ID.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**scope**: Service scope.

To let OM use the Power BI APIs using your Azure AD app, you'll need to add the following scopes:
- https://analysis.windows.net/powerbi/api/.default

Instructions for adding these scopes to your app can be found by following this link: https://analysis.windows.net/powerbi/api/.default.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**authorityUri**: Authority URI for the service.

To identify a token authority, you can provide a URL that points to the authority in question.

If you don't specify a URL for the token authority, we'll use the default value of https://login.microsoftonline.com/.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**hostPort**: URL to the PowerBI instance.

To connect with your Power BI instance, you'll need to provide the host URL. If you're using an on-premise installation of Power BI, this will be the domain name associated with your instance.

If you don't specify a host URL, we'll use the default value of https://app.powerbi.com to connect with your Power BI instance.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**Pagination Entity Per Page**:

The pagination limit for Power BI APIs can be set using this parameter. The limit determines the number of records to be displayed per page.

By default, the pagination limit is set to 100 records, which is also the maximum value allowed.
{% /codeInfo %}

{% codeInfo srNumber=8 %}

**Use Admin APIs**:

Option for using the PowerBI admin APIs:

Refer to the section [here](/connectors/dashboard/powerbi#powerbi-admin-and-nonadmin-apis) to get more information.

- Enabled (Use PowerBI Admin APIs)
- Disabled (Use Non-Admin PowerBI APIs)

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/dashboard/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: powerbi
  serviceName: local_powerbi
  serviceConnection:
    config:
      type: PowerBI
```
```yaml {% srNumber=1 %}
      clientId: clientId
```
```yaml {% srNumber=2 %}
      clientSecret: secret
```
```yaml {% srNumber=3 %}
      tenantId: tenant
```
```yaml {% srNumber=4 %}
      # scope:
      #    - https://analysis.windows.net/powerbi/api/.default (default)
```
```yaml {% srNumber=5 %}
      # authorityURI: https://login.microsoftonline.com/ (default)
```
```yaml {% srNumber=6 %}
      # hostPort: https://analysis.windows.net/powerbi (default)
```
```yaml {% srNumber=7 %}
      # pagination_entity_per_page: 100 (default)
```
```yaml {% srNumber=8 %}
      # useAdminApis: true (default)
```

{% partial file="/v1.3/connectors/yaml/dashboard/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
