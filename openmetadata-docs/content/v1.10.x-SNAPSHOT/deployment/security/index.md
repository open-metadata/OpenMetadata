---
title: Enable Security | OpenMetadata Deployment Security
description: Learn about authentication, encryption, secret management, and provider configurations for securing your platform deployment.
slug: /deployment/security
collate: false
---

# Enable Security

This section provides detailed instructions to secure the REST endpoints of the OpenMetadata Server.

OpenMetadata has support for Google SSO, Okta SSO, custom OIDC, Auth0, Azure SSO, Amazon Cognito, and OneLogin as identity providers. Please see the next sections about how to configure them.

Enabling Security is only required for your **Production** installation. If you are testing OpenMetadata, it will be easier 
and faster to set up without security. To get up and running quickly with OpenMetadata (without security), 
please follow the [Quickstart](/quick-start) guide.

{% note %}

OpenMetadata currently does not support the simultaneous use of multiple authentication mechanisms, such as combining SSO and Basic Authentication.

{% /note %}

{%inlineCalloutContainer%}
  {%inlineCallout
    color="violet-70"
    bold="Auth0 SSO"
    icon="add_moderator"
    href="/deployment/security/auth0"%}
    Configure Auth0 SSO to access the UI and APIs
  {%/inlineCallout%}
  {%inlineCallout
    color="violet-70"
    bold="Azure SSO"
    icon="add_moderator"
    href="/deployment/security/azure"%}
    Configure Azure SSO to access the UI and APIs
  {%/inlineCallout%}
  {%inlineCallout
    color="violet-70"
    bold="Custom OIDC SSO"
    icon="add_moderator"
    href="/deployment/security/custom-oidc"%}
    Configure a Custom OIDC SSO to access the UI and APIs
  {%/inlineCallout%}
  {%inlineCallout
    color="violet-70"
    bold="Google SSO"
    icon="add_moderator"
    href="/deployment/security/google"%}
    Configure Google SSO to access the UI and APIs
  {%/inlineCallout%}
  {%inlineCallout
    color="violet-70"
    bold="Okta SSO"
    icon="add_moderator"
    href="/deployment/security/okta"%}
    Configure Okta SSO to access the UI and APIs
  {%/inlineCallout%}
  {%inlineCallout
    color="violet-70"
    bold="Amazon Cognito SSO"
    icon="add_moderator"
    href="/deployment/security/amazon-cognito"%}
    Configure Amazon Cognito SSO to access the UI and APIs
  {%/inlineCallout%}
  {%inlineCallout
    color="violet-70"
    bold="OneLogin SSO"
    icon="add_moderator"
    href="/deployment/security/one-login"%}
    Configure OneLogin SSO to access the UI and APIs
  {%/inlineCallout%}
  {%inlineCallout
    color="violet-70"
    bold="Keycloak SSO"
    icon="add_moderator"
    href="/deployment/security/keycloak"%}
    Configure Keycloak SSO to access the UI and APIs
  {%/inlineCallout%}
{%/inlineCalloutContainer%}
