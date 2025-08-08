---
title: Azure SSO Integration | Enable Secure Login for Collate
description: Learn to set up Azure SSO for Collate. Register your app, retrieve client and tenant IDs, and configure secure authentication for production environments.
slug: /security/azure
collate: true
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

{% note %}

- **SPA (Single Page Application):**  
  This type is designed for implicit flows. In this case, providing both the client ID and client secret will result in a failure because the implicit flow only requires the client ID for authentication.

- **Web:**  
  This type is intended for confidential clients. If you select this option, you must provide both the client ID and client secret. Simply passing the client ID will cause the authorization process to fail, as the Authorization Code flow requires both credentials for successful authentication.

### Recommendation:

- Use the **Web** type for confidential clients that require both a client ID and secret.
- Use the **SPA** type for applications using implicit flows where only a client ID is needed.

{% /note %}

{% image src="/images/v1.8/deployment/security/azure/create-app-3.png" alt="create-app" /%}

### Step 3: Where to Find the Credentials

- The `Client ID` and the `Tenant ID` are displayed in the Overview section of the registered application.

{% image src="/images/v1.8/deployment/security/azure/where-to-find-credentials.png" alt="create-app" /%}

- When passing the details for `authority`, the `Tenant ID` is added to the URL as shown in the example
  below. `https://login.microsoftonline.com/TenantID`

```commandline
"authority": "https://login.microsoftonline.com/c11234b7c-b1b2-9854-0mn1-56abh3dea295"
```

You will need to share the following information with the Collate team:
- Client ID
- Tenant ID
