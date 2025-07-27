---
title: Auth0 SSO for Docker | OpenMetadata Deployment Guide
description: Implement Auth0 Authorization Code Flow to manage user authentication securely with backend service token exchange and login session tracking.
slug: /deployment/security/auth0/auth-code-flow
collate: false
---

# Auth Code Flow

### Step 1: Create a New Application

- Once you are on the Dashboard page, click on `Applications > Applications` available on the left-hand side panel.

{% image 
src="/images/v1.8/deployment/security/auth0/create-new-app-1.png" 
alt="create-app" /%}

- Click on `Create Application`.

{% image 
src="/images/v1.8/deployment/security/auth0/create-new-app-2.png" 
alt="create-app" /%}

- Enter the Application name.
- Choose an application type and click on `Create`.

{% image 
src="/images/v1.8/deployment/security/auth0/auth-code-flow-1.png" 
alt="create-app" /%}

### Step 2: Where to Find the Credentials

- Navigate to the Settings tab. 
- You will find your `Client ID` and `Client Secret`.

{% image 
src="/images/v1.8/deployment/security/auth0/auth-code-flow-2.png" 
alt="credentials" /%}

After the applying these steps, you can update the configuration of your deployment:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/auth0/docker" %}
    Configure Auth0 SSO for your Docker Deployment.
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/auth0/bare-metal" %}
    Configure Auth0 SSO for your Bare Metal Deployment.
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Kubernetes Security"
    href="/deployment/security/auth0/kubernetes" %}
    Configure Auth0 SSO for your Kubernetes Deployment.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}


{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="MdArrowBack"
    bold="Auth"
    href="/deployment/security/auth0" %}
    Go to Auth0 Configuration
  {% /inlineCallout %}
{% /inlineCalloutContainer %}