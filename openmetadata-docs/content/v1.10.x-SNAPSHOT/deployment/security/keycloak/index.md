---
title: Keycloak SSO | OpenMetadata Security Integration
description: Use Keycloak as your authentication server to centralize identity management with support for OIDC and SSO integrations.
slug: /deployment/security/keycloak
collate: false
---

# Keycloak SSO

Follow the sections in this guide to set up Keycloak SSO.

{% note %}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Keycloak SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

{% /note %}

## Create Server Credentials

### Step 1: Access the Keycloak Admin Console

- You need an administrator account. If you don't have, see [Creating the first administrator](https://www.keycloak.org/docs/latest/server_admin/#creating-first-admin_server_administration_guide).
- Go to the URL for the Admin Console. For example, for localhost, use this URL: http://localhost:8080/admin/

{% image src="/images/v1.10/deployment/security/keycloak/1-login-page.png" alt="login-page" /%}

- Enter the username and password you created.

### Step 2: Change Realm selected
- The Keycloak use Realms as the primary form of organization, we can't use the realm "master" for new clients (apps), only for administration, so change for your specific realm or create a new.
- In this example we are used an existing one called "Data-sec".

{% image src="/images/v1.10/deployment/security/keycloak/keycloak-step-2.png" alt="change-realm" /%}

## Create Server Credentials

## Choose Your Authentication Flow

After creating the account, choose the authentication flow you want to use:

- [Implicit Flow](/deployment/security/keycloak/implicit-flow) (Public)
- [Auth Code Flow](/deployment/security/keycloak/auth-code-flow) (Confidential)

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


{% partial file="/v1.10/deployment/configure-ingestion.md" /%}
