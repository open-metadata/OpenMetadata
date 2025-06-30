---
title: Auth0 SSO
slug: /security/auth0
collate: true
---

# Auth0 SSO

Follow the sections in this guide to set up Auth0 SSO.

{%important%}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Auth0 SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

{%/important%}

## Create Server Credentials

### Step 1: Create the Account

- If you don't have an account, [Sign up](https://auth0.com/signup) to create one.
- Select the Account Type, i.e., Company or Personal
- Click I need advanced settings and click next.

{% image 
src="/images/v1.9/deployment/security/auth0/create-account-1.png" 
alt="create-account" /%}

- Provide the Tenant Domain, select the region and click on Create Account.

{% image 
src="/images/v1.9/deployment/security/auth0/create-account-2.png" 
alt="create-account" /%}

- Once done, you will land on the dashboard page.

{% image
src="/images/v1.9/deployment/security/auth0/create-account-3.png" 
alt="create-account" /%}

### Step 2: Create a New Application

- Once you are on the Dashboard page, click on `Applications > Applications` available on the left-hand side panel.

{% image 
src="/images/v1.9/deployment/security/auth0/create-new-app-1.png" 
alt="create-app" /%}

- Click on `Create Application`.

{% image 
src="/images/v1.9/deployment/security/auth0/create-new-app-2.png" 
alt="create-app" /%}

- Enter the Application name.
- Choose an application type and click on `Create`.

{% image 
src="/images/v1.9/deployment/security/auth0/create-new-app-3.png" 
alt="create-app" /%}

### Step 3: Where to Find the Credentials

- Navigate to the Settings tab. 
- You will find your `Client ID` and `Domain`.

{% image 
src="/images/v1.9/deployment/security/auth0/credentials.png" 
alt="credentials" /%}

You will need to share the following information with the Collate team:
- Client ID
- Domain
