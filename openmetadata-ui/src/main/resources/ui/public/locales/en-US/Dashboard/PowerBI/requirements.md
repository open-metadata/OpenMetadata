# Requirements
PowerBi Pro license is required to access the APIs

# PowerBI can be configured using two types of Authentication Mechanisms

## 1. Basic Authentication
With this authentication, the PowerBI ingestion process will only scan the dashboards and charts from the workspaces that the user has been granted access to, instead of scanning all available workspaces. This limits the scope of the ingestion process to only those resources that the user has permission to access.

### Step 1: Disable 2FA/MFA on the account
The PowerBI ingestion process can only be performed on accounts that do not have two-factor authentication (2FA) or multi-factor authentication (MFA) enabled. If an account has 2FA/MFA enabled, the ingestion process will not work for that account.
### Step 2: Provide necessary API permissions to the app
Go to the `Azure Ad app registrations` page, select your app and add the dashboard permissions to the app for PowerBI service and grant admin consent for the same:
- Dashboard.Read.All
- Dashboard.ReadWrite.All

## 2. Service Pricipal Authentication
This authentication requires admin level access and the PowerBI ingestion will scan all the available PowerBI workspaces to fetch the all metadata for dashboards and charts
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

You can find further information on the PowerBi connector in the [docs](https://docs.open-metadata.org/connectors/dashboard/powerbi).