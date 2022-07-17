---
title: Google SSO
slug: /deployment/security/google
---

# Google SSO

Follow the sections in this guide to set up Google SSO.

<Collapse title="Create Server Credentials">

### Step 1: Create the Account
- Go to [Create Google Cloud Account](https://console.cloud.google.com/)
- Click on `Create Project`

<Image src="/images/deployment/security/google/create-account.png" alt="create-account" caption="Create a New Account"/>

### Step 2: Create a New Project
Enter the **Project name**.
Enter the parent organization or folder in the **Location box**. That resource will be the hierarchical parent of the new project.
Click **Create**.
<Image src="/images/deployment/security/google/create-project.png" alt="create-project" caption="Create a New Project"/>

### Step 3: How to Configure OAuth Consent
- Select the project you created above and click on **APIs & Services** on the left-side panel.
<Image src="/images/deployment/security/google/configure-oauth-consent.png" alt="configure-oauth-consent"/>

- Click on the **OAuth Consent Screen** available on the left-hand side panel.
- Choose User Type **Internal**.
<Image src="/images/deployment/security/google/select-user-type.png" alt="select-user-type"/>

- Once the user type is selected, provide the **App Information** and other details.
- Click **Save and Continue**.
<Image src="/images/deployment/security/google/save-app-information.png" alt="save-app-information"/>

- On the **Scopes Screen**, Click on **ADD OR REMOVE SCOPES** and select the scopes.
- Once done click on **Update**.
<Image src="/images/deployment/security/google/scopes-screen.png" alt="scopes-screen"/>

- Click **Save and Continue**.
<Image src="/images/deployment/security/google/save-edit-app-registration.png" alt="save-edit-app-registration"/>

- Click on **Back to Dashboard**.
<Image src="/images/deployment/security/google/back-to-dashboard.png" alt="back-to-dashboard"/>
<Image src="/images/deployment/security/google/back-to-dashboard-2.png" alt="back-to-dashboard"/>

### Step 4: Create Credentials for the Project
- Once the OAuth Consent is configured, click on **Credentials** available on the left-hand side panel.
<Image src="/images/deployment/security/google/create-credentials.png" alt="create-credentials"/>

- Click on **Create Credentials**
- Select **OAuth client ID** from the dropdown.
<Image src="/images/deployment/security/google/select-outh-client-id.png" alt="cselect-outh-client-id"/>

- Once selected, you will be asked to select the **Application type**. Select **Web application**.
<Image src="/images/deployment/security/google/select-web-application.png" alt="select-web-application"/>

After selecting the **Application Type**, name your project and give the authorized URIs:
  - domain/callback
  - domain/silent-callback
<Image src="/images/deployment/security/google/authorized-urls.png" alt="authorized-urls"/>

- Click **Create**
- You will get the credentials
<Image src="/images/deployment/security/google/get-the-credentials.png" alt="get-the-credentials"/>

### Step 5: Where to Find the Credentials
- Go to **Credentials**
- Click on the **pencil icon (Edit OAuth Client)** on the right side of the screen
<Image src="/images/deployment/security/google/find-credentials.png" alt="find-credentials"/>

- You will find the **Client ID** and **Client Secret** in the top right corner
<Image src="/images/deployment/security/google/find-clientid-and-secret.png" alt="find-clientid-and-secret"/>

</Collapse>

<Collapse title="Create Service Account">
This is a guide to create ingestion bot service account.

### Step 1: Create Service-Account
- Navigate to your project dashboard
<Image src="/images/deployment/security/google/create-service-account.png" alt="create-service-account"/>

- Click on **Credentials** on the left side panel
<Image src="/images/deployment/security/google/click-credentials.png" alt="click-credentials"/>

- Click on **Manage service accounts** available on the center-right side.
<Image src="/images/deployment/security/google/manage-service-accounts.png" alt="manage-service-accounts"/>

- Click on **CREATE SERVICE ACCOUNT**
<Image src="/images/deployment/security/google/click-save-create-service-account.png" alt="click-save-create-service-account"/>

- Provide the required service account details.

<Note>

Ensure that the Service Account ID is **ingestion-bot** and click on **CREATE AND CONTINUE**. If you chose a different Service Account Id, add it to the default bots list in [Configure OpenMetadata Server](https://github.com/StreamlineData/catalog/tree/3d53fa7c645ea55f846b06d0210ac63f8c38463f/docs/install/install/google-catalog-config.md)

</Note>
<Image src="/images/deployment/security/google/required-account-details.png" alt="required-account-details"/>

- Click on **Select a role** and give the **Owner** role. Then click **Continue**.
<Image src="/images/deployment/security/google/select-owner-role.png" alt="select-owner-role"/>


- Click **DONE**
<Image src="/images/deployment/security/google/click-done-service-account.png" alt="click-done-service-account"/>


- Now you should see your service account listed.
<Image src="/images/deployment/security/google/listed-service-account.png" alt="listed-service-account"/>


### Step 2: Enable Domain-Wide Delegation

- Click on the service account in the list.
<Image src="/images/deployment/security/google/enable-domain-wide-delegation.png" alt="enable-domain-wide-delegation"/>


- On the details page, click on **SHOW DOMAIN-WIDE DELEGATION**
<Image src="/images/deployment/security/google/show-domain-wide-delegation.png" alt="show-domain-wide-delegation"/>

- Enable Google Workspace Domain-wide Delegation
- Click on **SAVE**
<Image src="/images/deployment/security/google/enable-google-domain-wide-delegation.png" alt="enable-google-domain-wide-delegation"/>

### How to Generate Private-Key/Service-Account JSON File

- Once done with the above steps, click on **KEYS** available next to the **DETAILS** tab.
- Click on **ADD KEY** and select **Create a new key**.
<Image src="/images/deployment/security/google/create-new-key.png" alt="create-new-key"/>

- Select the format. The **JSON format** is recommended.
- Next, click on **CREATE**
<Image src="/images/deployment/security/google/save-json.png" alt="save-json"/>

- The private-key/service-account JSON file will be downloaded.

</Collapse>

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
    authProvider: auth0
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```
