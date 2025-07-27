---
title: Keycloak SSO for Bare Metal
slug: /deployment/security/keycloak/bare-metal
collate: false
---

# Keycloak SSO for Bare Metal

## Update conf/openmetadata.yaml

In `openmetadata.yaml` file and use the following example as a reference. Replace the placeholder values with the details generated during your keycloak account and application credentials setup.

Check the more information about environment variable [here](/deployment/security/configuration-parameters).

{% codeWithLanguageSelector title="Auth Configuration" id="container-1" languagesArray=["implicit","authcode"] theme="dark" %}

```implicit
# Implicit Flow
authorizerConfiguration:
  className: "org.openmetadata.service.security.DefaultAuthorizer"
  containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
  adminPrincipals:                                          # Your `name` from name@domain.com
    - "admin"
    - "user1"
    - "user2"
  principalDomain: "open-metadata.org"                      # Update with your Domain,The primary domain for the organization (your domain.com from name@domain.com).
authenticationConfiguration:
  provider: "custom-oidc" 
  publicKeyUrls:                                            # Update with your keycloak Domain and  OMD server URL.
    - "{OMD-server-domain}/api/v1/system/config/jwks"       # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
    - "{Keycloak-server-URL}/auth/realms/{your-realm-name}/protocol/openid-connect/certs"           # Update your Keycloak Url And Realm.
  authority: "{Keycloak-server-URL}/auth/realms/{your-realm-name}"      
  clientId: "{Client ID}"
  callbackUrl: "http://localhost:8585/callback"
  clientType: "public"
```

```authcode
# Auth Code Flow 
authorizerConfiguration:
  className: "org.openmetadata.service.security.DefaultAuthorizer"
  containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
  adminPrincipals:                                          # Your `name` from name@domain.com
    - "admin"
    - "user1"
    - "user2"
  principalDomain: "open-metadata.org"                      # Update with your Domain,The primary domain for the organization (your domain.com from name@domain.com).
authenticationConfiguration:
  provider: "custom-oidc" 
  publicKeyUrls:                                            # Update with your keycloak Domain and  OMD server URL.
    - "{OMD-server-domain}/api/v1/system/config/jwks"       # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
    - "{Keycloak-server-URL}/auth/realms/{your-realm-name}/protocol/openid-connect/certs"                   # Update your Keycloak Url And Realm.
  authority: "{Keycloak-server-URL}/auth/realms/{your-realm-name}"      
  clientId: "{Client ID}"
  callbackUrl: "http://localhost:8585/callback"
  clientType: "confidential"
  oidcConfiguration:
    id: "{Client ID}"                                       # Update you keycloak Client ID
    type: "keycloak"     
    secret: "{Client Secret}"                               # Update with keycloak Client Secret
    discoveryUri:"{Keycloak-server-URL}/realms/{your-realm-name}/.well-known/openid-configuration"          # Keycloak's discovery URI Update your Keycloak's Domain and Realm
    callbackUrl: http://localhost:8585/callback"
    serverUrl: "http://localhost:8585"


```
{% /codeWithLanguageSelector %}


{% note %}

Altering the order of claims in `jwtPrincipalClaims` may lead to problems when matching a user from a token with an existing user in the system. The mapping process relies on the specific order of claims, so changing it can result in inconsistencies or authentication failures, as the system cannot ensure correct user mapping with a new claim order.

{% /note %}

{% partial file="/v1.9/deployment/configure-ingestion.md" /%}


{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="MdArrowBack"
    bold="KeyCloak"
    href="/deployment/security/keycloak" %}
    Go to KeyCloak Configuration
  {% /inlineCallout %}
{% /inlineCalloutContainer %}