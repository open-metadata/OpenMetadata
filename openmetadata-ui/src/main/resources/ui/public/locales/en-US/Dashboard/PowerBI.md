# PowerBI

In this section, we provide guides and references to use the PowerBI connector.

## Requirements

To access the PowerBI APIs and import dashboards, charts, and datasets from PowerBI into OpenMetadata, a **PowerBI Pro** license is necessary.

## PowerBI Account Setup and Permissions

### Step 1: Create an Azure AD app and configure the PowerBI Admin console

Please follow the steps mentioned <a href="https://docs.microsoft.com/en-us/power-bi/developer/embedded/embed-service-principal" target="_blank">here</a> for setting up the Azure AD application service principle and configure PowerBI admin settings.

Login to <a href="https://app.powerbi.com/" target="_blank">Power BI</a> as Admin and from the `Tenant` settings allow the following permissions:
- Allow service principles to use Power BI APIs,
- Allow service principals to use read-only Power BI admin APIs,
- Enhance admin APIs responses with detailed metadata.

### Step 2: Provide necessary API permissions to the app

Go to the `Azure Ad app registrations` page, select your app and add the dashboard permissions to the app for PowerBI service and grant admin consent for the same:

The required permissions are:
- `Dashboard.Read.All`

Optional Permissions: (Without granting these permissions, the dataset information cannot be retrieved and the lineage and datamodels processing will be skipped)
- `Dataset.Read.All`

$$note
Make sure that in the API permissions section, **Tenant**-related permissions are not being given to the app
Please refer <a href="https://stackoverflow.com/questions/71001110/power-bi-rest-api-requests-not-authorizing-as-expected" target="_blank">here</a> for detailed explanation
$$

### Step 3: Create New PowerBI workspace

The service principal only works with <a href="https://docs.microsoft.com/en-us/power-bi/collaborate-share/service-create-the-new-workspaces" target="_blank">new workspaces</a> (<a href="https://community.powerbi.com/t5/Service/Error-while-executing-Get-dataset-call-quot-API-is-not/m-p/912360#M85711" target="_blank">reference</a>).

You can find further information on the PowerBi connector in the <a href="https://docs.open-metadata.org/connectors/dashboard/powerbi" target="_blank">docs</a>.

## Connection Details

$$section
### Client ID $(id="clientId")

To get the Client ID (also known as application ID), follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for embedding your Power BI content.
4. From the `Overview` section, copy the `Application (client) ID`.
$$

$$section
### Client Secret $(id="clientSecret")

To get the client secret, follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for embedding your Power BI content.
4. Under `Manage`, select `Certificates & secrets`.
5. Under `Client secrets`, select `New client secret`.
6. In the `Add a client secret` pop-up window, provide a description for your application secret. Choose when the application should expire, and select `Add`.
7. From the `Client secrets` section, copy the string in the `Value` column of the newly created application secret.
$$

$$section
### Tenant ID $(id="tenantId")

To get the tenant ID, follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Power BI.
4. From the `Overview` section, copy the `Directory (tenant) ID`.
$$

$$section
### Authority URI $(id="authorityURI")

To identify a token authority, you can provide a URL that points to the authority in question.

If you don't specify a URL for the token authority, we'll use the default value of `https://login.microsoftonline.com/`.
$$

$$section
### Host Port $(id="hostPort")

To connect with your Power BI instance, you'll need to provide the host URL. If you're using an on-premise installation of Power BI, this will be the domain name associated with your instance.

If you don't specify a host URL, we'll use the default value of `https://app.powerbi.com` to connect with your Power BI instance.
$$

$$section
### Scope $(id="scope")

To let OM use the Power BI APIs using your Azure AD app, you'll need to add the following scopes:
- `https://analysis.windows.net/powerbi/api/.default`

Instructions for adding these scopes to your app can be found by following this link: https://analysis.windows.net/powerbi/api/.default.
$$

$$section
### Pagination Entity Per Page $(id="pagination_entity_per_page")

The pagination limit for Power BI APIs can be set using this parameter. The limit determines the number of records to be displayed per page.

By default, the pagination limit is set to 100 records, which is also the maximum value allowed.
$$

$$section
### Use Admin APIs $(id="useAdminApis")

Option for using the PowerBI admin APIs:
- `Enabled` (Use PowerBI Admin APIs)
Using the admin APIs will fetch the dashboard and chart metadata from all the workspaces available in the PowerBI instance.
There are no limitations on the Datasets that are retrieved for creating lineage information.

- `Disabled` (Use Non-Admin PowerBI APIs)
Using the non-admin APIs will only fetch the dashboard and chart metadata from the workspaces that have the security group of the service principal assigned to them.
Also lineage information can only be generated if the dataset is a <a href="https://learn.microsoft.com/en-us/rest/api/power-bi/push-datasets" target="_blank">Push Dataset</a>.
For more information please visit the PowerBI official documentation <a href="https://learn.microsoft.com/en-us/rest/api/power-bi/push-datasets/datasets-get-tables#limitations" target="_blank">here</a>.

$$
