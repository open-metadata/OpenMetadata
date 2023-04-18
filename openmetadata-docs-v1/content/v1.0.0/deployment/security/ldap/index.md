---
title: Ldap Authentication
slug: /deployment/security/ldap
---

# Setting up Ldap Authentication
<Important>

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Auth0 SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

</Important>

OpenMetadata allows using LDAP for validating email and password authentication.
Once setup successfully, the user should be able to sign in to OpenMetadata using the Ldap credentials.

Below are the configuration types to set up the LDAP Authentication:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/ldap/docker"
  >
    Configure LDAP for your Docker Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/ldap/bare-metal"
  >
    Configure LDAP for your Bare Metal Deployment.
  </InlineCallout>
</InlineCalloutContainer>

## Metadata Ingestion

For ingesting metadata when LDAP is enabled, it is mandatory to configure the `ingestion-bot` account with the JWT configuration. 
To know how to enable it, you can follow the documentation of [Enable JWT Tokens](/deployment/security/enable-jwt-tokens).
