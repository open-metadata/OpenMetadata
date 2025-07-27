---
title: OIDC Based Authentication
slug: /deployment/security/configuration-parameters
collate: false
---

# Configuration Reference Parameters

## Public Key Url (publicKeyUrls): 
This needs to be updated as per different SSO providers. The default value is `http://localhost:8585/api/v1/system/config/jwks`. This is the URL where the public keys are stored. The public keys are used to verify the signature of the JWT token.

{%important%}

**Google**: https://www.googleapis.com/oauth2/v3/certs

**Okta**: https://dev-19259000.okta.com/oauth2/aus5836ihy7o8ivuJ5d7/v1/keys

**Auth0**: https://dev-3e0nwcqx.us.auth0.com/.well-known/jwks.json

**Azure**: https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys

Also if you have enabled [JWT Tokens](/deployment/security/enable-jwt-tokens) then http://localhost:8585/api/v1/system/config/jwks also needs to be there in the list with proper server url.

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
Provide the callback URL where the OIDC provider redirects after authentication. Update ${OIDC_CALLBACK:-"http://localhost:8585/callback"} with your actual callback URL.

{%important%}

The only initial part of the URL should be changed, the rest of the URL should be the same as the default one. The default URL is `http://localhost:8585/callback`.
Also, this should match what you have configured in your OIDC provider.

{%important%}

## Server URL (serverUrl): 
Specify the URL of your OM Server. Default is http://localhost:8585.

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

## Config (config):
The central configuration block for OpenMetadata.

## Provider (provider):
Specifies the authentication method to be used. 
The default is `ldap`, but you can change it to another supported provider. Example: `google`, `azure`.

## Entity Id (entityId):
The unique identifier for the SAML Identity Provider.  
Example: `"https://mocksaml.com/api/saml/sso"`
  
## SSO Login URL (ssoLoginUrl):
The URL to which users are redirected for Single Sign-On (SSO) authentication.  
Example: `"https://saml.example.com/entityid"`

## IPDX509 Certificate (idpX509Certificate):
The public certificate used by the IdP to sign SAML assertions.  
Example: `""` (empty string means no certificate provided, needs to be set with actual certificate)

## Authority URL (authorityUrl):
The URL used for SAML login, typically a custom endpoint for your SAML provider.  
Example: `"http://localhost:8585/api/v1/saml/login"`

## Name ID (nameId):
The format for the NameID element in the SAML response, usually representing the unique identifier of the user.  
Example: `"urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"`

## ACS (acs):
The Assertion Consumer Service (ACS) URL, where the IdP sends the SAML response after authentication.  
Example: `"http://localhost:8585/api/v1/saml/acs"`

## SPX509 Certificate (spX509Certificate):
The public certificate used by the Service Provider to verify the IdP's SAML response.  
Example: `""` (empty string means no certificate provided, needs to be set with actual certificate)

## Strict Mode (strictMode):
Whether to enforce strict compliance with the SAML standard, ensuring the response is fully validated.  
Default: `false`

## Token Validity (tokenValidity):
The validity period of the SAML token in seconds.  
Default: `"3600"` (1 hour)

## Send Encrypted Name ID (sendEncryptedNameId):
Whether to send the NameID in an encrypted format in the SAML response.  
Default: `false`

## Send Signed Auth Request (sendSignedAuthRequest):
Whether to sign the authentication request sent to the IdP.  
Default: `false`

## Sign SP Metadata (signSpMetadata):
Whether to sign the Service Provider's metadata when exchanging SAML metadata with the IdP.  
Default: `false`

## Want Messages Signed (wantMessagesSigned):
Whether the Service Provider expects SAML messages to be signed.  
Default: `false`

## Want Assertions Signed (wantAssertionsSigned):
Whether the Service Provider expects SAML assertions to be signed.  
Default: `false`

## Want Assertion Encrypted (wantAssertionEncrypted):
Whether to encrypt the SAML assertion before sending it to the Service Provider.  
Default: `false`

## Want Name ID Encrypted (wantNameIdEncrypted):
Whether to encrypt the NameID element in the SAML response.  
Default: `false`

## Key Store File Path (keyStoreFilePath):
The file path to the keystore file containing certificates and private keys used for signing and encryption.  
Example: `""` (empty string means no keystore file provided)

## KeyStore Alias (keyStoreAlias):
The alias used to refer to the key inside the keystore file.  
Example: `""` (empty string means no alias provided)

## KeyStore Password (keyStorePassword):
The password used to access the keystore file.  
Example: `""` (empty string means no password provided)

## Class Name (className):
Specifies the class that handles the authorization logic.  
Default: `"org.openmetadata.service.security.DefaultAuthorizer"`

## Container Request Filter (containerRequestFilter):
Specifies the request filter used to process authentication, especially for handling JWT tokens.  
Default: `"org.openmetadata.service.security.JwtFilter"`

## Initial Admins (initialAdmins):
A list of users who will be granted administrative privileges during the initial setup.  
Example: `["suresh"]`

## Principal Domain (principalDomain):
The domain that is associated with user accounts.  
Default: `"open-metadata.org"`

## Authority (authority):
The base URL of the OIDC authority.  
Example: Replace `{IssuerUrl}` with the URL of your custom OIDC provider.

## Client ID (clientId):
The client ID for the application registered with the custom OIDC provider.  
Replace `{client id}` with the actual client ID.

## Host (host):
The hostname of the LDAP server. Defaults to `localhost`.

## Port (port):
The port number to connect to the LDAP server. Defaults to `10636`.

## DN Admin Principal (dnAdminPrincipal):
The distinguished name (DN) of the admin user used for lookup operations in LDAP. Defaults to `"cn=admin,dc=example,dc=com"`.

## DN Admin Password (dnAdminPassword):
The password for the admin user. Defaults to `"secret"`.

## Userbase DN (userBaseDN):
The base DN for user lookup in LDAP. Defaults to `"ou=people,dc=example,dc=com"`.

## Mail Attribute Name (mailAttributeName):
The attribute name in LDAP that stores user email addresses. Defaults to `email`.

## Maximum Pool Size (maxPoolSize) (Optional):
Defines the maximum number of connections in the LDAP connection pool. Defaults to `3`.

## SSL Enabled (sslEnabled):
Indicates if SSL is enabled for connecting to the LDAP server. Defaults to `true`.

## Custom Trust Manager Configuration (customTrustManagerConfig):
  - ### TrustStore FilePath (trustStoreFilePath):
    Path to the custom trust store file. Default is empty.  
  - ### TrustStore File Password (trustStoreFilePassword):
    Password for the trust store file. Default is empty.  
  - ### TrustStore File Format (trustStoreFileFormat):
    Format of the trust store file. Default is empty.  
  - ### Verify Host Name (verifyHostname):
    If hostname verification is enabled. Default is empty.  
  - ### Examine Validity Dates (examineValidityDates):
    Whether to check validity dates for certificates. Default is empty.  

## Host Name Configuration (hostNameConfig):
  - ### Allow Wild Cards (allowWildCards):
    Allows wildcard certificates in hostnames. Default is empty.  
  - ### Acceptable Host Names (acceptableHostNames):
    A list of acceptable hostnames. Default is an empty list.  

## JVM Default Configurations (jvmDefaultConfig):
  - ### Verify Host Name (verifyHostname):
    Enables hostname verification using JVM defaults. Default is empty.  

## Trust All Configurations (trustAllConfig):
  - ### Examine Validity Dates (examineValidityDates):
    Checks the validity dates of certificates when using `TrustAll` mode. Defaults to `true`.

## Enforce Principal Domain (enforcePrincipalDomain):
Whether to enforce user principal matching with the defined principal domain

## Enable Secure Socket Connection (enableSecureSocketConnection):
If true, enables secure connections (SSL/TLS)

## Use Roles From Provider (useRolesFromProvider):
Whether to derive roles from the authentication provider

## Initial Admins (initialAdmins):
List of initial admin users for the system

## JWT Principal Claims (jwtPrincipalClaims):
JWT claims used to identify the principal (user)

## JWT Principal Claims Mapping (jwtPrincipalClaimsMapping):
Mapping of JWT claims to application-specific claims

## Enable Self Signup (enableSelfSignup):
Allows users to sign up themselves if not already registered

## Preferred JWT Algorithms (preferredJwsAlgorithm):
Preferred algorithm for JWT signature validation

## Allowed Email Registration Domains (allowedEmailRegistrationDomains):
Specifies allowed domains for email registration
