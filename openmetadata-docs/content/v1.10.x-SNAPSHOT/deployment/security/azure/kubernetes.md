---
title: Azure SSO for Kubernetes | Official Documentation
description: Connect Kubernetes to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /deployment/security/azure/kubernetes
collate: false
---

# Azure SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Check the more information about environment variable [here](/deployment/security/configuration-parameters).

Here is an example for reference, showing where to place the values in the `values.yaml` file after setting up your Azure account and obtaining the application credentials.

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
      provider: "azure"
      publicKeys:
      - "{your domain}/api/v1/system/config/jwks"                    # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
      - "https://login.microsoftonline.com/common/discovery/keys"
      authority: "https://login.microsoftonline.com/{Tenant ID}"     # Update your Tenant ID  
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
      provider: "azure" 
      publicKeys:
      - "{your domain}/api/v1/system/config/jwks"                   # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
      - "https://login.microsoftonline.com/common/discovery/keys"
      authority: "https://login.microsoftonline.com/{Tenant ID}"    # Update your Tenant ID
      clientId: "{Client ID}"                                       # Update your Client ID
      callbackUrl: "http://localhost:8585/callback"
      oidcConfiguration:
        oidcType: "azure"
        oidcConfiguration.enabled: true
        clientId:
          secretRef: oidc-secrets
          secretKey: openmetadata-oidc-client-id  
        clientSecret:
          secretRef: oidc-secrets
          secretKey: openmetadata-oidc-client-secret  
        discoveryUri: "https://login.microsoftonline.com/.well-known/openid-configuration"     
        callbackUrl: http://localhost:8585/callback  
        serverUrl: http://localhost:8585  
```

{% /codeWithLanguageSelector %}

{% note %}

Altering the order of claims in `jwtPrincipalClaims` may lead to problems when matching a user from a token with an existing user in the system. The mapping process relies on the specific order of claims, so changing it can result in inconsistencies or authentication failures, as the system cannot ensure correct user mapping with a new claim order.

{% /note %}

{% partial file="/v1.10/deployment/configure-ingestion.md" /%}


{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="MdArrowBack"
    bold="Azure"
    href="/deployment/security/azure" %}
    Go to Azure Configuration
  {% /inlineCallout %}
{% /inlineCalloutContainer %}