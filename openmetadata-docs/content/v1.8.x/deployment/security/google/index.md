---
title: Google SSO | OpenMetadata Authentication Integration
description: Set up Google OAuth as your identity provider to enable secure login, token exchange, and scoped user access in deployments.
slug: /deployment/security/google
collate: false
---

# Google SSO

Follow the sections in this guide to set up Google SSO.

{% note %}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Google SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

{% /note %}

## Create Server Credentials

### Step 1: Create the Account
- Go to [Create Google Cloud Account](https://console.cloud.google.com/)
- Click on `Create Project`

{% image src="/images/v1.8/deployment/security/google/create-account.png" alt="create-account" caption="Create a New Account" /%}

### Step 2: Create a New Project
Enter the **Project name**.
Enter the parent organization or folder in the **Location box**. That resource will be the hierarchical parent of the new project.
Click **Create**.
{% image src="/images/v1.8/deployment/security/google/create-project.png" alt="create-project" caption="Create a New Project" /%}

### Step 3: How to Configure OAuth Consent
- Select the project you created above and click on **APIs & Services** on the left-side panel.
{% image src="/images/v1.8/deployment/security/google/configure-oauth-consent.png" alt="configure-oauth-consent" /%}

- Click on the **OAuth Consent Screen** available on the left-hand side panel.
- Choose User Type **Internal**.
{% image src="/images/v1.8/deployment/security/google/select-user-type.png" alt="select-user-type" /%}

- Once the user type is selected, provide the **App Information** and other details.
- Click **Save and Continue**.
{% image src="/images/v1.8/deployment/security/google/save-app-information.png" alt="save-app-information" /%}

- On the **Scopes Screen**, Click on **ADD OR REMOVE SCOPES** and select the scopes.
- Once done click on **Update**.
{% image src="/images/v1.8/deployment/security/google/scopes-screen.png" alt="scopes-screen" /%}

- Click **Save and Continue**.
{% image src="/images/v1.8/deployment/security/google/save-edit-app-registration.png" alt="save-edit-app-registration" /%}

- Click on **Back to Dashboard**.
{% image src="/images/v1.8/deployment/security/google/back-to-dashboard.png" alt="back-to-dashboard" /%}
{% image src="/images/v1.8/deployment/security/google/back-to-dashboard-2.png" alt="back-to-dashboard" /%}

### Step 4: Create Credentials for the Project
- Once the OAuth Consent is configured, click on **Credentials** available on the left-hand side panel.
{% image src="/images/v1.8/deployment/security/google/create-credentials.png" alt="create-credentials" /%}

- Click on **Create Credentials**
- Select **OAuth client ID** from the dropdown.
{% image src="/images/v1.8/deployment/security/google/select-outh-client-id.png" alt="cselect-outh-client-id" /%}

- Once selected, you will be asked to select the **Application type**. Select **Web application**.
{% image src="/images/v1.8/deployment/security/google/select-web-application.png" alt="select-web-application" /%}

After selecting the **Application Type**, name your project and give the authorized URIs:
  - domain/callback
  - domain/silent-callback
{% image src="/images/v1.8/deployment/security/google/authorized-urls.png" alt="authorized-urls" /%}

- Click **Create**
- You will get the credentials
{% image src="/images/v1.8/deployment/security/google/get-the-credentials.png" alt="get-the-credentials" /%}

### Step 5: Where to Find the Credentials
- Go to **Credentials**
- Click on the **pencil icon (Edit OAuth Client)** on the right side of the screen
{% image src="/images/v1.8/deployment/security/google/find-credentials.png" alt="find-credentials" /%}

- You will find the **Client ID** in the top right corner
{% image src="/images/v1.8/deployment/security/google/find-clientid-and-secret.png" alt="find-clientid-and-secret" /%}

After the applying these steps, you can update the configuration of your deployment:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/google/docker" %}
    Configure Auth0 SSO for your Docker Deployment.
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/google/bare-metal" %}
    Configure Auth0 SSO for your Bare Metal Deployment.
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Kubernetes Security"
    href="/deployment/security/google/kubernetes" %}
    Configure Auth0 SSO for your Kubernetes Deployment.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

{% partial file="/v1.8/deployment/configure-ingestion.md" /%}
