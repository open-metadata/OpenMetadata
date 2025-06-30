---
title: OneLogin SSO | OpenMetadata Authentication Setup
slug: /deployment/security/one-login
collate: false
---

# OneLogin SSO

Follow the sections in this guide to set up OneLogin SSO.

{% note %}
Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with OneLogin SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

{% /note %}

## Create Server Credentials

### Step 1: Configure a new Application

- Login to [OneLogin](https://www.onelogin.com/) as an administrator and click on Applications

{% image src="/images/v1.8/deployment/security/one-login/create-server-credentials-1.png" alt="create-account" /%}

- Click on the `Add App` button and search for `openid connect`
- Select the `OpenId Connect (OIDC)` app

{% image src="/images/v1.8/deployment/security/one-login/create-server-credentials-2.png" alt="create-account" /%}

- Change the Display Name of the app to `Open Metadata` and click `Save`

{% image src="/images/v1.8/deployment/security/one-login/create-server-credentials-3.png" alt="create-account" /%}

- Configure the login Url (`http(s)://<domain>/signin`) and redirect URI (`http(s)://<domain>/callback`) as shown below

{% image src="/images/v1.8/deployment/security/one-login/create-server-credentials-4.png" alt="create-account" /%}

- Configure the users in the organization that can access OpenMetadata app by clicking on the `Users`

{% image src="/images/v1.8/deployment/security/one-login/create-server-credentials-5.png" alt="create-account" /%}

- Click on "SSO" and select `None (PKCE)` for Token Endpoint.

{% image src="/images/v1.8/deployment/security/one-login/create-server-credentials-6.png" alt="create-account" /%}

### Step 2: Where to find the Credentials

- Go to "SSO" and copy the Client ID 

{% image src="/images/v1.8/deployment/security/one-login/create-server-credentials-7.png" alt="create-account" /%}

- Copy the Issuer URL

After the applying these steps, you can update the configuration of your deployment:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/one-login/docker" %}
    Configure OneLogin SSO for your Docker Deployment.
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/one-login/bare-metal" %}
    Configure OneLogin SSO for your Bare Metal Deployment.
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Kubernetes Security"
    href="/deployment/security/one-login/kubernetes" %}
    Configure OneLogin SSO for your Kubernetes Deployment.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

{% partial file="/v1.8/deployment/configure-ingestion.md" /%}
