---
title: Custom OIDC SSO Setup | Configure Secure Login for Collate
description: Set up Custom OIDC SSO for Collate. Generate client ID and secret with your preferred OIDC provider, and secure production with proper JWT and user management.
slug: /security/custom-oidc
collate: true
---

# Custom OIDC SSO

Follow the sections in this guide to set up Custom OIDC SSO.

{% note %}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Custom OIDC SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

{% /note %}

## Create Server Credentials

- Go to the console of your preferred custom OIDC SSO provider
- Create an OIDC client application with implicit flow enabled to get a client ID.

### Create Client ID and Secret Key

- Navigate to your preferred OIDC provider console and create an OIDC client application.
- Generate client ID and secret key in JSON format.

You will need to share the following information with the Collate team:
- Client ID
