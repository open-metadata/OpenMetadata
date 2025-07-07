---
title: oidcClientConfig | OpenMetadata OIDC Client Config
slug: /main-concepts/metadata-standard/schemas/security/client/oidcclientconfig
---

# OidcClientConfig

*Oidc client security configs.*

## Properties

- **`type`** *(string)*: IDP type (Example Google,Azure).
- **`id`** *(string)*: Client ID.
- **`secret`** *(string)*: Client Secret.
- **`scope`** *(string)*: Oidc Request Scopes. Default: `"openid email profile"`.
- **`discoveryUri`** *(string)*: Discovery Uri for the Client.
- **`useNonce`** *(string)*: Use Nonce. Default: `true`.
- **`preferredJwsAlgorithm`** *(string)*: Preferred Jws Algorithm. Default: `"RS256"`.
- **`responseType`** *(string)*: Auth0 Client Secret Key. Default: `"code"`.
- **`disablePkce`** *(boolean)*: Disable PKCE. Default: `true`.
- **`maxClockSkew`** *(string)*: Max Clock Skew.
- **`clientAuthenticationMethod`** *(string)*: Client Authentication Method. Must be one of: `["client_secret_basic", "client_secret_post", "client_secret_jwt", "private_key_jwt"]`.
- **`tokenValidity`** *(integer)*: Validity for the JWT Token created from SAML Response. Default: `"3600"`.
- **`customParams`** *(object)*: Custom Params.
- **`tenant`** *(string)*: Tenant in case of Azure.
- **`serverUrl`** *(string)*: Server Url.
- **`callbackUrl`** *(string)*: Callback Url.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
