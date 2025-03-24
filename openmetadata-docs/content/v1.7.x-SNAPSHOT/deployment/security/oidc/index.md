---
title: OIDC Based Authentication
slug: /deployment/security/oidc
collate: false
---

# Setting up Any Oidc Provider
{%important%}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Auth0 SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

{%important%}

This guide provides instructions on setting up OpenID Connect (OIDC) configuration for your application. OpenID Connect is a simple identity layer built on top of the OAuth 2.0 protocol that allows clients to verify the identity of the end-user.
Below configurations are universally applicable to all SSO provider like Google, Auth0, Okta, Keycloak, etc.

{% note %}

OpenMetadata sessions are currently stored **in-memory**, which may cause issues when using **OIDC authentication** in a multi-replica setup.

- If you are experiencing **authentication failures with "Missing state parameter" errors**, enabling **sticky sessions** can serve as a temporary workaround.

{% /note %}

Below are the configuration types to set up the OIDC Authentication with a Confidential Client type:

```yaml
  authenticationConfiguration:
    clientType: ${AUTHENTICATION_CLIENT_TYPE:-confidential}
    publicKeyUrls: ${AUTHENTICATION_PUBLIC_KEYS:-[http://localhost:8585/api/v1/system/config/jwks]}
    oidcConfiguration:
      id: ${OIDC_CLIENT_ID:-""}
      type: ${OIDC_TYPE:-""} # google, azure etc.
      secret: ${OIDC_CLIENT_SECRET:-""}
      scope: ${OIDC_SCOPE:-"openid email profile"}
      discoveryUri: ${OIDC_DISCOVERY_URI:-""}
      useNonce: ${OIDC_USE_NONCE:-true}
      preferredJwsAlgorithm: ${OIDC_PREFERRED_JWS:-"RS256"}
      responseType: ${OIDC_RESPONSE_TYPE:-"code"}
      disablePkce: ${OIDC_DISABLE_PKCE:-true}
      callbackUrl: ${OIDC_CALLBACK:-"http://localhost:8585/callback"}
      serverUrl: ${OIDC_SERVER_URL:-"http://localhost:8585"}
      clientAuthenticationMethod: ${OIDC_CLIENT_AUTH_METHOD:-"client_secret_post"}
      tenant: ${OIDC_TENANT:-""}
      maxClockSkew: ${OIDC_MAX_CLOCK_SKEW:-""}
      customParams: ${OIDC_CUSTOM_PARAMS:-}
```
Check the more information about environment variable [here](/deployment/security/configuration-parameters).
