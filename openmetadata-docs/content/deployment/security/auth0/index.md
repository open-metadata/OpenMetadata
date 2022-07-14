---
title: Auth0 SSO
slug: /deployment/security/auth0
---

# Auth0 SSO

Follow the sections in this guide to set up Auth0 SSO.

<Collapse title="Create Server Credentials">

### Step 1: Create the Account

- If you don't have an account, [Sign up](https://auth0.com/signup) to create one.
- Select the Account Type, i.e., Company or Personal
- Click I need advanced settings and click next.

<Image src="/images/deployment/security/auth0/create-account-1.png" alt="create-account"/>

- Provide the Tenant Domain, select the region and click on Create Account.

<Image src="/images/deployment/security/auth0/create-account-2.png" alt="create-account"/>

- Once done, you will land on the dashboard page.

<Image src="/images/deployment/security/auth0/create-account-3.png" alt="create-account"/>

### Step 2: Create a New Application

- Once you are on the Dashboard page, click on `Applications > Applications` available on the left-hand side panel.

<Image src="/images/deployment/security/auth0/create-new-app-1.png" alt="create-app"/>

- Click on `Create Application`.

<Image src="/images/deployment/security/auth0/create-new-app-2.png" alt="create-app"/>

- Enter the Application name.
- Choose an application type and click on `Create`.

<Image src="/images/deployment/security/auth0/create-new-app-3.png" alt="create-app"/>

### Step 3: Where to Find the Credentials

- Navigate to the Settings tab. 
- You will find your `Client ID`, `Client Secret` and `Domain`.

<Image src="/images/deployment/security/auth0/credentials.png" alt="credentials"/>

</Collapse>

<Collapse title="Create Service Account">

This section will guide to to create the Ingestion Bot service account.

### Step 1: Enable Client-Credential

- Go to your project dashboard.

<Image src="/images/deployment/security/auth0/enable-client-credential-1.png" alt="client"/>

- Navigate to `Applications > Applications`

<Image src="/images/deployment/security/auth0/enable-client-credential-2.png" alt="client"/>

- Select your application from the list.

<Image src="/images/deployment/security/auth0/enable-client-credential-3.png" alt="client"/>

- Once selected, scroll down until you see the `Application Properties` section.
- Change the Token Endpoint `Authentication Method` from `None` to `Basic`.

<Image src="/images/deployment/security/auth0/enable-client-credential-4.png" alt="client"/>

- Now scroll further down to the section on `Advanced Settings`.
- Click on it and select `Grant Types`.
- In the `Grant Types`, check the option for `Client Credentials`.

<Image src="/images/deployment/security/auth0/enable-client-credential-5.png" alt="client"/>

- Once done, click on `Save Changes`.

### Step 2: Authorize the API with our Application.

- Navigate to `Applications > APIs` from the left menu.

<Image src="/images/deployment/security/auth0/authorize-api-1.png" alt="auth"/>

- You will see the `Auth0 Management API`.

<Image src="/images/deployment/security/auth0/authorize-api-2.png" alt="auth"/>

- Click on the `Auth0 Management API`.

<Image src="/images/deployment/security/auth0/authorize-api-3.png" alt="auth"/>

- Click on the `Machine to Machine Applications` tab.
- You will find your application listed below.

<Image src="/images/deployment/security/auth0/authorize-api-4.png" alt="auth"/>

- Click on the toggle to authorize.
- Once done you will find a down arrow, click on it.

<Image src="/images/deployment/security/auth0/authorize-api-5.png" alt="auth"/>

- Select the permissions (scopes) that should be granted to the client.
- Click on `Update`.

<Image src="/images/deployment/security/auth0/authorize-api-6.png" alt="auth"/>

</Collapse>

After the applying these steps, you can update the configuration of your deployment:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/auth0/docker"
  >
    Configure Auth0 SSO for your Docker Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/auth0/bare-metal"
  >
    Configure Auth0 SSO for your Bare Metal Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Kubernetes Security"
    href="/deployment/security/auth0/kubernetes"
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
