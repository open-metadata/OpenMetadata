---
title: Auth0 SSO for Docker | OpenMetadata Deployment Guide
slug: /deployment/security/azure/implicit-flow
collate: false
---

# Implicit Flow

### Step 1: App Registrations

- Provide an Application Name for registration.
- Provide a redirect URL as a Single Page Application (SPA).
- Click on Register.

{% image src="/images/v1.8/deployment/security/azure/create-app-3.png" alt="create-app" /%}

### Step 2: Where to Find the Credentials

- The `Client ID` and the `Tenant ID` are displayed in the Overview section of the registered application.

{% image src="/images/v1.8/deployment/security/azure/client-id-and-authority.png" alt="create-app" /%}

- When passing the details for `authority`, the `Tenant ID` is added to the URL as shown in the example
  below. `https://login.microsoftonline.com/TenantID`

```commandline
"authority": "https://login.microsoftonline.com/c11234b7c-b1b2-9854-0mn1-56abh3dea295"
```

{% partial file="/v1.8/deployment/configure-ingestion.md" /%}


After the applying these steps, Now you can update the configuration of your deployment:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/azure/docker" %}
    Configure Azure SSO for your Docker Deployment.
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/azure/bare-metal" %}
    Configure Azure SSO for your Bare Metal Deployment.
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Kubernetes Security"
    href="/deployment/security/azure/kubernetes" %}
    Configure Azure SSO for your Kubernetes Deployment.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}


{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="MdArrowBack"
    bold="Azure"
    href="/deployment/security/azure" %}
    Go to Azure Configuration
  {% /inlineCallout %}
{% /inlineCalloutContainer %}