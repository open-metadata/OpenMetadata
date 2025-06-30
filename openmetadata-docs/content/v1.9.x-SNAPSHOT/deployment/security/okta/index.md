---
title: Okta SSO | OpenMetadata Authentication Integration
slug: /deployment/security/okta
collate: false
---

# Okta SSO

Follow the sections in this guide to set up Okta SSO.

{% note %}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Okta SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

{% /note %}

## Create Server Credentials

This document will explain how to create an Okta app and configure it for OAuth. This will generate the information required for Single Sign On with Okta.

### Step 1: Create an Okta Account
- Go to [Create Okta Account](https://developer.okta.com/signup/).
- Provide the required input and click on Sign Up.
- Else you can continue with Google or GitHub.

### Step 2: Create the OIDC App Integration.
- Once done with **Signup/Sign** in, you will be redirected to the **Getting Started** page in Okta.
{% image src="/images/v1.9/deployment/security/okta/create-oidc-app-integration.png" alt="create-oidc-app-integration" /%}

- Click on **Applications -> Applications** in the left navigation panel.
{% image src="/images/v1.9/deployment/security/okta/click-applications.png" alt="click-applications" /%}

- Click on the **Create App Integration** button.
{% image src="/images/v1.9/deployment/security/okta/create-app-integration.png" alt="create-app-integration" /%}

## Choose Your Authentication Flow

After creating the account, choose the authentication flow you want to use:

- [Implicit Flow](/deployment/security/okta/implicit-flow) (Public)
- [Auth Code Flow](/deployment/security/okta/auth-code-flow) (Confidential)


{% note %}

- **SPA (Single Page Application):**  
  This type is designed for implicit flows. In this case, providing both the client ID and client secret will result in a failure because the implicit flow only requires the client ID for authentication.

- **Web:**  
  This type is intended for confidential clients. If you select this option, you must provide both the client ID and client secret. Simply passing the client ID will cause the authorization process to fail, as the Authorization Code flow requires both credentials for successful authentication.
  The [OIDC Authorization Code Flow](/deployment/security/oidc) is used in this case, where the client secret is required to securely exchange the authorization code for tokens.


### Recommendation:

- Use the **Web** type for confidential clients that require both a client ID and secret.
- Use the **SPA** type for applications using implicit flows where only a client ID is needed.

{% /note %}


{% partial file="/v1.9/deployment/configure-ingestion.md" /%}
