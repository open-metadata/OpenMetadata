---
title: Auth0 SSO for Kubernetes | Official Documentation
description: Connect Kubernetes to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /deployment/security/auth0/kubernetes
collate: false
---

# Auth0 SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).
Check the more information about environment variable [here](/deployment/security/configuration-parameters).

Here is an example for reference, showing where to place the values in the `values.yaml` file after setting up your Auth0 account and obtaining the application credentials.

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
      provider: "auth0"
      publicKeys: 
      - "{your domain}/api/v1/system/config/jwks" # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
      - "{Auth0 Domain Name}/.well-known/jwks.json"
      authority: "{Your Auth0 Domain}"  # The base URL of the authentication provider.      
      clientId: "{Client ID}"
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
      provider: "auth0" 
      publicKeys:  # List of URLs providing public keys for verifying JWT tokens.
        - "{Your Domain}/api/v1/system/config/jwks"    # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
        - "{Auth0 Domain Name}/.well-known/jwks.json
      authority: "{Your Auth0 Domain}"  # The base URL of the authentication provider.
      clientId: "{Client ID}"  # Update your Client ID
      callbackUrl: "http://localhost:8585/callback"
      oidcConfiguration:
        oidcType: "Auth0"  
        clientId:
          secretRef: oidc-secrets
          secretKey: openmetadata-oidc-client-id  
        clientSecret:
          secretRef: oidc-secrets
          secretKey: openmetadata-oidc-client-secret  
        discoveryUri: "{Domain name}/.well-known/openid-configuration"  # Update your Auth0 Domain
        callbackUrl: http://localhost:8585/callback  
        serverUrl: http://localhost:8585  
```

{% /codeWithLanguageSelector %}

{% partial file="/v1.10/deployment/configure-ingestion.md" /%}

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="MdArrowBack"
    bold="Auth"
    href="/deployment/security/auth0" %}
    Go to Auth0 Configuration
  {% /inlineCallout %}
{% /inlineCalloutContainer %}