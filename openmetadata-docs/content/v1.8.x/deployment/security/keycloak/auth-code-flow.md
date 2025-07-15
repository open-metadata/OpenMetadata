---
title: Auth code flow of Keyclock | Official Documentation
description: Implement Keycloak’s Authorization Code Flow for backend-based secure logins using token exchange, identity claims, and session control.
slug: /deployment/security/keycloak/auth-code-flow
collate: false
---

# Auth Code Flow 


### Step 1: Create OpenMetadata as a new Client
- Click on `Clients` in the menu.
- Click on `Create Client` button.
- Select the `Client type`.
- Enter the `Client ID`.
- Enter the Name and Description `(Optional)`.
- Click on `Next` button.

{% image src="/images/v1.8/deployment/security/keycloak/keycloak-step-3.png" alt="add-client" /%}

### Step 2: Edit Configs of the client
- Enable `Client authentication` and `Authorization`.
- Select `Standard flow` as an `Authentication flow`.
- Click `Next`.

{% image src="/images/v1.8/deployment/security/keycloak/keycloak-step-4.png" alt="compatibility configs" /%}

### Step 3: Add Login Settings
- fill the required options

{% image src="/images/v1.8/deployment/security/keycloak/keycloak-step-5.png" alt="edit-settings-url.png" /%}

- Click on `Save` button.

{% note %}

Note: Scopes `openid`, `email` & `profile` are required to fetch the user details so you will have to add these scopes in your client.

{% /note %}

### Step 3: Where to Find the Credentials

- Navigate to the `Credentials` tab.
- You will find your `Client Secret` related to the Client id "open-metadata"

{% image src="/images/v1.8/deployment/security/keycloak/keycloak-step-6.png" alt="client-credentials" /%}


After the applying these steps, the users in your realm are able to login in the openmetadata, as a suggestion create a user called "admin-user". Now you can update the configuration of your deployment:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/keycloak/docker" %}
    Configure Keycloak SSO for your Docker Deployment.
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/keycloak/bare-metal" %}
    Configure Keycloak SSO for your Bare Metal Deployment.
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Kubernetes Security"
    href="/deployment/security/keycloak/kubernetes" %}
    Configure Keycloak SSO for your Kubernetes Deployment.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="MdArrowBack"
    bold="KeyCloak"
    href="/deployment/security/keycloak" %}
    Go to KeyCloak Configuration
  {% /inlineCallout %}
{% /inlineCalloutContainer %}