---
title: Keycloak SSO for Kubernetes
slug: /deployment/security/keycloak/kubernetes
collate: false
---

# Keycloak SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Here is an example for reference, showing where to place the values in the `values.yaml` file after setting up your Keycloak account and obtaining the application credentials.

Check the more information about environment variable [here](/deployment/security/configuration-parameters).


{% codeWithLanguageSelector title="Auth Configuration" id="container-1" languagesArray=["implicit","authcode"] theme="dark" %}

```implicit
# Public Flow

openmetadata:
  config:
    authorizer:
      className: "org.openmetadata.service.security.DefaultAuthorizer"
      containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
      initialAdmins:  # john.doe from john.doe@example.com
      - "admin"
      - "user1"
      - "user2"
      principalDomain: "open-metadata.org"  # Update with your Domain,The primary domain for the organization (example.com from john.doe@example.com).  

    authentication:
      clientType: public
      provider: "custom-oidc"
      publicKeys:
      - "{OMD-server-domain}/api/v1/system/config/jwks" # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
      - "{Keycloak-server-URL}/realms/{your-realm-name}/protocol/openid-connect/certs"
      authority: "{Keycloak-server-URL}/realms/{your-realm-name}/protocol/openid-connect/auth"      
      clientId: "{Client ID}"                                        # Update your Client ID
      callbackUrl: "http://localhost:8585/callback"
```

```authcode
# Auth Code Flow 

openmetadata:
  config:
    authorizer:
      className: "org.openmetadata.service.security.DefaultAuthorizer"
      containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
      initialAdmins:  # john.doe from john.doe@example.com
      - "admin"
      - "user1"
      - "user2"
      principalDomain: "open-metadata.org"  # Update with your Domain,The primary domain for the organization (example.com from john.doe@example.com).  

    authentication:
      clientType: confidential
      provider: "custom-oidc"
      publicKeys:
      - "{OMD-server-domain}/api/v1/system/config/jwks" # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
      - "{Keycloak-server-URL}/realms/{your-realm-name}/protocol/openid-connect/certs"
      authority: "{Keycloak-server-URL}/realms/{your-realm-name}/protocol/openid-connect/auth"      
      clientId: "{Client ID}"                                        # Update your Client ID
      callbackUrl: "http://localhost:8585/callback"
      oidcConfiguration:
        enabled: true
        oidcType: "Keycloak"  
        clientId:
          secretRef: oidc-secrets
          secretKey: openmetadata-oidc-client-id  
        clientSecret:
          secretRef: oidc-secrets
          secretKey: openmetadata-oidc-client-secret  
        discoveryUri:"{Keycloak-server-URL}/realms/{your-realm-name}/.well-known/openid-configuration"  # Keycloak's discovery URI Update your Keycloak's Domain and Realm
        callbackUrl: http://localhost:8585/callback  
        serverUrl: http://localhost:8585  
```

{% /codeWithLanguageSelector %}

{% note %}

Altering the order of claims in `jwtPrincipalClaims` may lead to problems when matching a user from a token with an existing user in the system. The mapping process relies on the specific order of claims, so changing it can result in inconsistencies or authentication failures, as the system cannot ensure correct user mapping with a new claim order.

{% /note %}

{% partial file="/v1.6/deployment/configure-ingestion.md" /%}

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="MdArrowBack"
    bold="KeyCloak"
    href="/deployment/security/keycloak" %}
    Go to KeyCloak Configuration
  {% /inlineCallout %}
{% /inlineCalloutContainer %}
