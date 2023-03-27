# Requirements
PowerBi Pro license is required to access the APIs

## PowerBI Account Setup and Permissions

### Step 1: Create an Azure AD app and configure the PowerBI Admin consle

Please follow the steps mentioned [here](https://docs.microsoft.com/en-us/power-bi/developer/embedded/embed-service-principal) for setting up the Azure AD application service principle and configure PowerBI admin settings

Login to Power BI as Admin and from `Tenant` settings allow below permissions.
- Allow service principles to use Power BI APIs
- Allow service principals to use read-only Power BI admin APIs
- Enhance admin APIs responses with detailed metadata

### Step 2: Provide necessary API permissions to the app
Go to the `Azure Ad app registrations` page, select your app and add the dashboard permissions to the app for PowerBI service and grant admin consent for the same:
- Dashboard.Read.All
- Dashboard.ReadWrite.All

**Note**:
Make sure that in the API permissions section **Tenant** related permissions are not being given to the app
Please refer [here](https://stackoverflow.com/questions/71001110/power-bi-rest-api-requests-not-authorizing-as-expected) for detailed explanation 

### Step 3: Create New PowerBI workspace
The service principal only works with [new workspaces](https://docs.microsoft.com/en-us/power-bi/collaborate-share/service-create-the-new-workspaces).
[For reference](https://community.powerbi.com/t5/Service/Error-while-executing-Get-dataset-call-quot-API-is-not/m-p/912360#M85711)
