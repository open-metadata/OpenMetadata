---
title: LDAP Authentication | OpenMetadata Security Setup
slug: /deployment/security/ldap
collate: false
---

# Setting up Ldap Authentication
{%important%}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Auth0 SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

{%important%}

OpenMetadata allows using LDAP for validating email and password authentication.
Once setup successfully, the user should be able to sign in to OpenMetadata using the Ldap credentials.

Below are the configuration types to set up the LDAP Authentication:

{%inlineCalloutContainer%}
  {%inlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/ldap/docker"%}
    Configure LDAP for your Docker Deployment.
  {%/inlineCallout%}
  {%inlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/ldap/bare-metal"%}
    Configure LDAP for your Bare Metal Deployment.
  {%/inlineCallout%}
{%/inlineCalloutContainer%}

{% partial file="/v1.9/deployment/configure-ingestion.md" /%}
