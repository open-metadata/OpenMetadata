---
title: Azure SSO
slug: /deployment/security/azure
---

# Azure SSO

Follow the sections in this guide to set up Azure SSO.

## Create Server Credentials

### Step 1: Login to Azure Active Directory

- Login to [Microsoft Azure Portal](https://azure.microsoft.com/en-in/services/active-directory/external-identities/)
- Navigate to the Azure Active Directory.

<Note>

Admin permissions are required to register the application on the Azure portal.

</Note>

### Step 2: Create a New Application

- From the Azure Active Directory, navigate to the `App Registrations` section from the left nav bar.

<Image src="/images/deployment/security/azure/create-app-1.png" alt="create-app"/>

- Click on `New Registration`. This step is for registering the OpenMetadata UI.

<Image src="/images/deployment/security/azure/create-app-2.png" alt="create-app"/>

- Provide an Application Name for registration.
- Provide a redirect URL as a `Single Page Application`.
- Click on `Register`.

<Image src="/images/deployment/security/azure/create-app-3.png" alt="create-app"/>

### Step 3: Where to Find the Credentials

- The `Client ID` and the `Tenant ID` are displayed in the Overview section of the registered application.

<Image src="/images/deployment/security/azure/where-to-find-credentials.png" alt="create-app"/>

- When passing the details for `authority`, the `Tenant ID` is added to the URL as shown in the example
  below. `https://login.microsoftonline.com/TenantID`

```commandline
"authority": "https://login.microsoftonline.com/c11234b7c-b1b2-9854-0mn1-56abh3dea295"
```

## Create Service Application (optional)

This is a guide to create ingestion bot service account. This step is optional if you configure the ingestion-bot with 
the JWT Token, you can follow the documentation of [Enable JWT Tokens](/deployment/security/enable-jwt-tokens).

### Step 1: Access Tokens and ID Tokens

- Navigate to the newly registered application.
- Click on the `Authentication` section.
- Select the checkboxes for` Access Token` and `ID Tokens`.
- Click `Save`.

<Image src="/images/deployment/security/azure/access-tokens.png" alt="access-tokens"/>

### Step 2: Expose an API

- Navigate to the section `Expose an API`.

<Image src="/images/deployment/security/azure/expose-api-1.png" alt="expose-api"/>

- Set the `App ID URI`. If it has not been set, the default value is `api://<client_id>`.
- Click Save.

<Image src="/images/deployment/security/azure/expose-api-2.png" alt="expose-api"/>

### Step 3: Add a Scope

- Click on `Add a Scope`.
- Enter the details with a custom scope name to expose.
- Once completed, click on Add Scope.

<Image src="/images/deployment/security/azure/add-scope.png" alt="add-scope"/>

### Step 4: Register Another Azure Application

Another Azure Application must be registered for Service ingestion.

- Provide an application name.
- `public client redirect URI` will be blank.
- Click on Register.

<Image src="/images/deployment/security/azure/register-another-app.png" alt="add-app"/>

### Step 5: API Permissions

- Navigate to the Ingestion Application created in step 4.
- Navigate to the section on API Permissions.
- Click on Add a Permission.

<Image src="/images/deployment/security/azure/api-permissions-1.png" alt="api-permissions"/>

- Click on Add a Permission.

<Image src="/images/deployment/security/azure/api-permissions-2.png" alt="api-permissions"/>

- Select the custom scope created in Step 3.
- Click on Add Permissions.

<Image src="/images/deployment/security/azure/api-permissions-3.png" alt="api-permissions"/>

### Step 6: Grant Admin Consent for Default Directory

Open Metadata Ingestion authenticates and authorizes workflow connectivity with OpenMetadata API using OAuth2 
Client Credentials grant. In the Client Credentials flow, there is no GUI to consent application permissions 
since it’s a machine to machine communication. So OpenMetadata Ingestion Azure Application will need to be 
pre-consented by Azure Active Directory to use the scope request to connect to OpenMetadata Azure Application via 
the application access scope.

- Navigate to the Azure Active Directory >> Enterprise Application.
- Navigate to the ingestion application created in step 4. This is also called the Service Principal.
- Click on Permissions.
- Click on `Grant Admin Consent for Default Directory`.

<Image src="/images/deployment/security/azure/admin-consent.png" alt="admin-consent"/>

### Step 7: Set the App ID URI

- Navigate to the `Azure Active Directory >> App Registrations >> [OpenMetadata Ingestion Application] >> Expose an API`.
- Click on Set in Application ID URI

<Image src="/images/deployment/security/azure/set-app-id-1.png" alt="app-id"/>

- Click on Save to set the App ID URI which is required for scopes while connecting from manual ingestion.

<Image src="/images/deployment/security/azure/set-app-id-2.png" alt="app-id"/>

### Step 8: Create a Client Secret

- Navigate to `Certificates & Secrets` to generate the clientSecret.
- Click on New Client Secret.

<Image src="/images/deployment/security/azure/client-secret-1.png" alt="client-secret"/>

- Enter a description and an expiry period.

<Image src="/images/deployment/security/azure/client-secret-2.png" alt="client-secret"/>

- The `secret_key` is required for ingestion.

### Step 9: Note down the information for OpenMetadata configurations

- `clientID`: The Application (Client) ID is displayed in the Overview section of the registered applications (Azure Application for UI and Azure Service Application if any).
- `authority`: When passing the details for authority, the Tenant ID is added to the URL as shown
below. `https://login.microsoftonline.com/TenantID`
- `clientSecret`: The clientSecret can be accessed from the Certificates & secret section of the application.
- `scopes`: The scopes for running the ingestion to get token using Client Credentials Flow. This will be in the format of `<application-id-uri>/.default` (Application Id URI will be available from [Step 7](/deployment/security/azure#step-7-set-the-app-id-uri))
- `object-id`: You can fetch the `object id` of Azure Application created for OpenMetadata Service Application as provided in the below image. This is required for setting the OpenMetadata with YAML configurations as well as Updating Ingestion-Bot from UI. You can find `object id` in Azure `Active Directory >> Enterprise Applications`.

<Image src="/images/deployment/security/azure/azure-service-application-object-id.png" alt="object-id" />

This information is required to configure ingestion-bot from OpenMetadata UI from 0.12.1 Release.

After the applying these steps, you can update the configuration of your deployment:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/azure/docker"
  >
    Configure Azure SSO for your Docker Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/azure/bare-metal"
  >
    Configure Azure SSO for your Bare Metal Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Kubernetes Security"
    href="/deployment/security/azure/kubernetes"
  >
    Configure Azure SSO for your Kubernetes Deployment.
  </InlineCallout>
</InlineCalloutContainer>

### Step 10: Update Ingestion Bot with Azure SSO Service Application

Starting from 0.12.1, Navigate to `Settings >> Bots >> ingestion-bot` and click on edit.

<Image src="/images/deployment/security/azure/update-ingestion-bot-service-application.png"/>

Update the Auth Mechanism as Azure SSO and update `Email`, `ClientSecret`, `ClientId`, `Authority`, and `Scopes` as mentioned in [Step 9](/deployment/security/azure#step-9-note-down-the-clientid-and-authority).

The `Email` will be in the format of `<object-id-for-azure-service-application-enterprise-application>@<your-domain-name>`.

Next, Click on Save.

<Image src="/images/deployment/security/azure/update-ingestion-bot-service-application.png" />

This will enable all the Service Connector Ingestions created from UI to securely use Azure SSO Service Applications for connecting with OpenMetadata APIs.

## Configure Ingestion from CLI

After everything has been set up, you will need to configure your workflows if you are running them via the
`metadata` CLI or with any custom scheduler.

When setting up the YAML config for the connector, update the `workflowConfig` as follows:

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
        - <azure-service-application-id-uri>/.default

```

## Security note

For **production** environment, please:
- **DELETE** de admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Azure SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens) in case it is
  enabled.
