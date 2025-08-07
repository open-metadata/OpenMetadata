---
title: OneLogin SSO Integration | Enable Secure Access to Collate
description: Set up OneLogin SSO for Collate with OpenID Connect. Configure login and redirect URIs, assign users, manage tokens, and retrieve the Client ID and Issuer URL.
slug: /security/one-login
collate: true
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

{% image src="/images/v1.9/deployment/security/one-login/create-server-credentials-1.png" alt="create-account" /%}

- Click on the `Add App` button and search for `openid connect`
- Select the `OpenId Connect (OIDC)` app

{% image src="/images/v1.9/deployment/security/one-login/create-server-credentials-2.png" alt="create-account" /%}

- Change the Display Name of the app to `Open Metadata` and click `Save`

{% image src="/images/v1.9/deployment/security/one-login/create-server-credentials-3.png" alt="create-account" /%}

- Configure the login Url (`http(s)://<domain>/signin`) and redirect URI (`http(s)://<domain>/callback`) as shown below

{% image src="/images/v1.9/deployment/security/one-login/create-server-credentials-4.png" alt="create-account" /%}

- Configure the users in the organization that can access OpenMetadata app by clicking on the `Users`

{% image src="/images/v1.9/deployment/security/one-login/create-server-credentials-5.png" alt="create-account" /%}

- Click on "SSO" and select `None (PKCE)` for Token Endpoint.

{% image src="/images/v1.9/deployment/security/one-login/create-server-credentials-6.png" alt="create-account" /%}

### Step 2: Where to find the Credentials

- Go to "SSO" and copy the Client ID 

{% image src="/images/v1.9/deployment/security/one-login/create-server-credentials-7.png" alt="create-account" /%}

You will need to share the following information with the Collate team:
- Issuer URL
- Client ID
