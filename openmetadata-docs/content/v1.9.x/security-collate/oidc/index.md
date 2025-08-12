---
title: OIDC Authentication Setup | Universal SSO Configuration for Collate
description: Configure any OIDC provider for Collate with flexible options for scopes, discovery URLs, client methods, and token verification. Supports Google, Auth0, Azure, Okta.
slug: /security/oidc
collate: true
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

Below are the configuration types to set up the OIDC Authentication with a Confidential Client type:

```yaml
  authenticationConfiguration:
    clientType: ${AUTHENTICATION_CLIENT_TYPE:-confidential}
    publicKeyUrls: ${AUTHENTICATION_PUBLIC_KEYS:-[https://{your-collate-domain}/api/v1/system/config/jwks]}
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
      callbackUrl: ${OIDC_CALLBACK:-"https://{your-collate-domain}/callback"}
      serverUrl: ${OIDC_SERVER_URL:-"https://{your-collate-domain}"}
      clientAuthenticationMethod: ${OIDC_CLIENT_AUTH_METHOD:-"client_secret_post"}
      tenant: ${OIDC_TENANT:-""}
      maxClockSkew: ${OIDC_MAX_CLOCK_SKEW:-""}
      customParams: ${OIDC_CUSTOM_PARAMS:-}
```
# Configuration Parameters

## Public Key Url (publicKeyUrls): 
This needs to be updated as per different SSO providers. The default value is `https://{your-collate-domain}/api/v1/system/config/jwks`. This is the URL where the public keys are stored. The public keys are used to verify the signature of the JWT token.

{%important%}

**Google**: https://www.googleapis.com/oauth2/v3/certs

**Okta**: https://dev-19259000.okta.com/oauth2/aus5836ihy7o8ivuJ5d7/v1/keys

**Auth0**: https://dev-3e0nwcqx.us.auth0.com/.well-known/jwks.json

**Azure**: https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys

Also if you have enabled [JWT Tokens](/deployment/security/enable-jwt-tokens) then https://{your-collate-domain}/api/v1/system/config/jwks also needs to be there in the list with proper server url.

{%important%}

## Client ID (id):
The client ID provided by your OIDC provider. This is typically obtained when you register your application with the OIDC provider.

## Type (type): 
Specify the type of OIDC provider you are using (e.g., google, azure). This value is same as `provider` in `authenticationConfiguration`.

## Client Secret (secret): 
Replace with the client secret provided by your OIDC provider.

## Scope (scope): 
Define the scopes that your application requests during authentication. Update ${OIDC_SCOPE:-"openid email profile"} with the desired scopes.

{% note %}

It does not need to be changed in most cases. The default scopes are `openid email profile`. The openid scope is required for OIDC authentication. The email and profile scopes are used to retrieve the user's email address and profile information.
Although, some provider only give Refresh Token if `offline_access` scope is provided. So, if you want to use Refresh Token, you need to add `offline_access` scope, like below:
`offline_access openid email profile`.

{% /note %}

## Discovery URI (discoveryUri): 
Provide the URL of the OIDC provider's discovery document. This document contains metadata about the provider's configuration.

{%important%}

It is mostly in the format as below: https://accounts.google.com/.well-known/openid-configuration

**Google**: https://accounts.google.com/.well-known/openid-configuration

**Okta**: https://dev-19259000.okta.com/oauth2/aus5836ihy7o8ivuJ5d7/.well-known/openid-configuration

**Auth0**: https://dev-3e0nwcqx.us.auth0.com/.well-known/openid-configuration

**Azure**: https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration

Normally it's some initial SSO provider URL followed by `.well-known/openid-configuration`

{%important%}

## Use Nonce (useNonce): 
Set to true by Default, if you want to use nonce for replay attack protection during authentication. This does not need to be changed.

## Preferred JWS Algorithm (preferredJwsAlgorithm): 
Specify the preferred JSON Web Signature (JWS) algorithm. Default is RS256 and need not be changed .

## Response Type (responseType): 
Define the response type for the authentication request. Default is code and need not be changed.

## Disable PKCE (disablePkce): 
Set ${OIDC_DISABLE_PKCE:-true} to true if you want to disable Proof Key for Code Exchange (PKCE). If you want to send CodeVerifier and CodeChallenge in the request, set it to false.

## Callback URL (callbackUrl): 
Provide the callback URL where the OIDC provider redirects after authentication. Update ${OIDC_CALLBACK:-"https://{your-collate-domain}/callback"} with your actual callback URL.

{%important%}

The only initial part of the URL should be changed, the rest of the URL should be the same as the default one. The default URL is `https://{your-collate-domain}/callback`.
Also, this should match what you have configured in your OIDC provider.

{%important%}

## Server URL (serverUrl): 
Specify the URL of your OM Server. Default is https://{your-collate-domain}.

## Client Authentication Method (clientAuthenticationMethod): 
Define the method used for client authentication. Default is client_secret_post.

{%important%}

This does not need to be changed in most cases. The default value is `client_secret_post`. 
This method is used to send the client ID and client secret in the request body.
Another possible value is `client_secret_basic`, which sends the client ID and client secret in the Authorization header.
Depending on the OIDC provider, you may need to change this value if only one of them is supported.

{%important%}

## Tenant (tenant): 
If applicable, specify the tenant ID for multi-tenant applications. Example in case of Azure.

{%important%}

This is only applicable for multi-tenant applications. If you are using a single tenant application, you can leave this field empty.
For Azure SSO Provider this may be needed.

{%important%}

## Max Clock Skew (maxClockSkew): 
Define the maximum acceptable clock skew between your application server and the OIDC server.

## Custom Parameters (customParams): 
If you have any additional custom parameters required for OIDC configuration, specify them here.
