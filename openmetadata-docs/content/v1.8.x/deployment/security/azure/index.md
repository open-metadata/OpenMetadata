---
title: Azure SSO | OpenMetadata Authentication Integration
description: Deploy Azure authentication to manage secure token-based access and identity roles in cloud-native or hybrid environments.
slug: /deployment/security/azure
collate: false
---

# Azure SSO

Follow the sections in this guide to set up Azure SSO.

{% note %}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Azure SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

{% /note %}

## Create Server Credentials

### Step 1: Login to Azure Active Directory

- Login to [Microsoft Azure Portal](https://azure.microsoft.com/en-in/services/active-directory/external-identities/)
- Navigate to the Azure Active Directory.

{% note %}

Admin permissions are required to register the application on the Azure portal.

{% /note %}

### Step 2: Create a New Application

- From the Azure Active Directory, navigate to the `App Registrations` section from the left nav bar.

{% image src="/images/v1.8/deployment/security/azure/create-app-1.png" alt="create-app" /%} 

- Click on `New Registration`. This step is for registering the OpenMetadata UI.

{% image src="/images/v1.8/deployment/security/azure/create-app-2.png" alt="create-app" /%}

- Provide an Application Name for registration.
- Provide a redirect URL as a `Single Page Application`.
- Click on `Register`.

## Choose Your Authentication Flow

After creating the account, choose the authentication flow you want to use:

- [Implicit Flow](/deployment/security/azure/implicit-flow) (Public)
- [Auth Code Flow](/deployment/security/azure/auth-code-flow) (Confidential)

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


