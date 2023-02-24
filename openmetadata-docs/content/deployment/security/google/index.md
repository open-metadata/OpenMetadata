---
title: Google SSO
slug: /deployment/security/google
---

# Google SSO

Follow the sections in this guide to set up Google SSO.

<Important>

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Google SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

</Important>

## Create Server Credentials

### Step 1: Create the Account
- Go to [Create Google Cloud Account](https://console.cloud.google.com/)
- Click on `Create Project`

<Image src="/images/deployment/security/google/create-account.webp" alt="create-account" caption="Create a New Account"/>

### Step 2: Create a New Project
Enter the **Project name**.
Enter the parent organization or folder in the **Location box**. That resource will be the hierarchical parent of the new project.
Click **Create**.
<Image src="/images/deployment/security/google/create-project.webp" alt="create-project" caption="Create a New Project"/>

### Step 3: How to Configure OAuth Consent
- Select the project you created above and click on **APIs & Services** on the left-side panel.
<Image src="/images/deployment/security/google/configure-oauth-consent.webp" alt="configure-oauth-consent"/>

- Click on the **OAuth Consent Screen** available on the left-hand side panel.
- Choose User Type **Internal**.
<Image src="/images/deployment/security/google/select-user-type.webp" alt="select-user-type"/>

- Once the user type is selected, provide the **App Information** and other details.
- Click **Save and Continue**.
<Image src="/images/deployment/security/google/save-app-information.webp" alt="save-app-information"/>

- On the **Scopes Screen**, Click on **ADD OR REMOVE SCOPES** and select the scopes.
- Once done click on **Update**.
<Image src="/images/deployment/security/google/scopes-screen.webp" alt="scopes-screen"/>

- Click **Save and Continue**.
<Image src="/images/deployment/security/google/save-edit-app-registration.webp" alt="save-edit-app-registration"/>

- Click on **Back to Dashboard**.
<Image src="/images/deployment/security/google/back-to-dashboard.webp" alt="back-to-dashboard"/>
<Image src="/images/deployment/security/google/back-to-dashboard-2.webp" alt="back-to-dashboard"/>

### Step 4: Create Credentials for the Project
- Once the OAuth Consent is configured, click on **Credentials** available on the left-hand side panel.
<Image src="/images/deployment/security/google/create-credentials.webp" alt="create-credentials"/>

- Click on **Create Credentials**
- Select **OAuth client ID** from the dropdown.
<Image src="/images/deployment/security/google/select-outh-client-id.webp" alt="cselect-outh-client-id"/>

- Once selected, you will be asked to select the **Application type**. Select **Web application**.
<Image src="/images/deployment/security/google/select-web-application.webp" alt="select-web-application"/>

After selecting the **Application Type**, name your project and give the authorized URIs:
  - domain/callback
  - domain/silent-callback
<Image src="/images/deployment/security/google/authorized-urls.webp" alt="authorized-urls"/>

- Click **Create**
- You will get the credentials
<Image src="/images/deployment/security/google/get-the-credentials.webp" alt="get-the-credentials"/>

### Step 5: Where to Find the Credentials
- Go to **Credentials**
- Click on the **pencil icon (Edit OAuth Client)** on the right side of the screen
<Image src="/images/deployment/security/google/find-credentials.webp" alt="find-credentials"/>

- You will find the **Client ID** and **Client Secret** in the top right corner
<Image src="/images/deployment/security/google/find-clientid-and-secret.webp" alt="find-clientid-and-secret"/>

## Create Service Account (optional)

This is a guide to create ingestion bot service account. This step is optional if you configure the ingestion-bot with 
the JWT Token, you can follow the documentation of [Enable JWT Tokens](/deployment/security/enable-jwt-tokens).

### Step 1: Create Service-Account
- Navigate to your project dashboard
<Image src="/images/deployment/security/google/create-service-account.webp" alt="create-service-account"/>

- Click on **Credentials** on the left side panel
<Image src="/images/deployment/security/google/click-credentials.webp" alt="click-credentials"/>

- Click on **Manage service accounts** available on the center-right side.
<Image src="/images/deployment/security/google/manage-service-accounts.webp" alt="manage-service-accounts"/>

- Click on **CREATE SERVICE ACCOUNT**
<Image src="/images/deployment/security/google/click-save-create-service-account.webp" alt="click-save-create-service-account"/>

- Provide the required service account details.

<Note>

Ensure that the Service Account ID is **ingestion-bot** and click on **CREATE AND CONTINUE**. If you chose a different Service Account Id, add it to the default bots in OpenMetadata Server Configuration -> authorizerConfig section 

</Note>
<Image src="/images/deployment/security/google/required-account-details.webp" alt="required-account-details"/>

- Click on **Select a role** and give the **Owner** role. Then click **Continue**.
<Image src="/images/deployment/security/google/select-owner-role.webp" alt="select-owner-role"/>


- Click **DONE**
<Image src="/images/deployment/security/google/click-done-service-account.webp" alt="click-done-service-account"/>


- Now you should see your service account listed.
<Image src="/images/deployment/security/google/listed-service-account.webp" alt="listed-service-account"/>


### Step 2: Enable Domain-Wide Delegation

- Click on the service account in the list.
<Image src="/images/deployment/security/google/enable-domain-wide-delegation.webp" alt="enable-domain-wide-delegation"/>


- On the details page, click on **SHOW DOMAIN-WIDE DELEGATION**
<Image src="/images/deployment/security/google/show-domain-wide-delegation.webp" alt="show-domain-wide-delegation"/>

- Enable Google Workspace Domain-wide Delegation
- Click on **SAVE**
<Image src="/images/deployment/security/google/enable-google-domain-wide-delegation.webp" alt="enable-google-domain-wide-delegation"/>

### How to Generate Private-Key/Service-Account JSON File

- Once done with the above steps, click on **KEYS** available next to the **DETAILS** tab.
- Click on **ADD KEY** and select **Create a new key**.
<Image src="/images/deployment/security/google/create-new-key.webp" alt="create-new-key"/>

- Select the format. The **JSON format** is recommended.
- Next, click on **CREATE**
<Image src="/images/deployment/security/google/save-json.webp" alt="save-json"/>

- The private-key/service-account JSON file will be downloaded.

After the applying these steps, you can update the configuration of your deployment:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/google/docker"
  >
    Configure Auth0 SSO for your Docker Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/google/bare-metal"
  >
    Configure Auth0 SSO for your Bare Metal Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Kubernetes Security"
    href="/deployment/security/google/kubernetes"
  >
    Configure Auth0 SSO for your Kubernetes Deployment.
  </InlineCallout>
</InlineCalloutContainer>

## Configure Ingestion

After everything has been set up, you will need to configure your workflows if you are running them via the
`metadata` CLI or with any custom scheduler.

When setting up the YAML config for the connector, update the `workflowConfig` as follows:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: google
    securityConfig:
      secretKey: '{path-to-json-creds}'
```