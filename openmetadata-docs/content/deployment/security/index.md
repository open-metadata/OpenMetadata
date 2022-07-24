---
title: Enable Security
slug: /deployment/security
---

# Enable Security

This section provides detailed instructions to secure the REST endpoints of the OpenMetadata Server.

OpenMetadata has support for Google SSO, Okta SSO, custom OIDC, Auth0, and Azure SSO as identity providers. Please see
the next sections about how to configure them.

Enabling Security is only required for your **Production** installation. If you are testing OpenMetadata it will be easier 
and faster to set up without security. To get up and running quickly with OpenMetadata (without security), 
please follow the [Quickstart](/quick-start/local-deployment) guide.

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    bold="Auth0 SSO"
    icon="add_moderator"
    href="/deployment/security/auth0"
  >
    Configure Auth0 SSO to access the UI and APIs
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    bold="Azure SSO"
    icon="add_moderator"
    href="/deployment/security/azure"
  >
    Configure Azure SSO to access the UI and APIs
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    bold="Custom OIDC SSO"
    icon="add_moderator"
    href="/deployment/security/custom-oidc"
  >
    Configure a Custom OIDC SSO to access the UI and APIs
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    bold="Google SSO"
    icon="add_moderator"
    href="/deployment/security/google"
  >
    Configure Google SSO to access the UI and APIs
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    bold="Okta SSO"
    icon="add_moderator"
    href="/deployment/security/okta"
  >
    Configure Okta SSO to access the UI and APIs
  </InlineCallout>
</InlineCalloutContainer>
