---
title: Azure SSO for Bare Metal
slug: /deployment/security/azure/bare-metal
collate: false
---

# Azure SSO for Bare Metal


## Update conf/openmetadata.yaml

In `openmetadata.yaml` file and use the following example as a reference. Replace the placeholder values with the details generated during your azure account and application credentials setup.

Check the more information about environment variable [here](/deployment/security/configuration-parameters).


{% codeWithLanguageSelector title="Auth Configuration" id="container-1" languagesArray=["implicit","authcode"] theme="dark" %}

```implicit
# Implicit Flow
authorizerConfiguration:
  className: "org.openmetadata.service.security.DefaultAuthorizer"
  containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
  adminPrincipals:                          # Your `name` from name@domain.com
    - "admin"
    - "user1"
    - "user2"
  principalDomain: "open-metadata.org"      # Update with your Domain,The primary domain for the organization (your domain.com from name@domain.com).
authenticationConfiguration:
  provider: "azure" 
  publicKeyUrls:                            # Update with your azure Domain and  OMD server URL.
    - "https://login.microsoftonline.com/common/discovery/keys""
    - "{OMD URL}/api/v1/system/config/jwks"                    
  authority: "https://login.microsoftonline.com/{Tenant ID}"
  clientId: "{Client ID}"
  callbackUrl: "http://localhost:8585/callback"
  clientType: "public"
```

```authcode
# Auth Code Flow 
authorizerConfiguration:
  className: "org.openmetadata.service.security.DefaultAuthorizer"
  containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
  adminPrincipals:                          # Your `name` from name@domain.com
    - "admin"
    - "user1"
    - "user2"
  principalDomain: "open-metadata.org"      # Update with your Domain,The primary domain for the organization (your domain.com from name@domain.com).
authenticationConfiguration:
  provider: "azure" 
  publicKeyUrls:                            # Update with your azure Domain and  OMD server URL.
    - "https://login.microsoftonline.com/common/discovery/keys""
    - "{OMD URL}/api/v1/system/config/jwks"   
  authority: "https://login.microsoftonline.com/{Tenant ID}"                   # Update your Tenant ID
  clientId: "{Client ID}"                   # Update your Client ID
  callbackUrl: "http://localhost:8585/callback"
  clientType: "confidential"
  oidcConfiguration:
    id: "{Client ID}"                       # Update you azrue Client ID
    type: "azure"     
    secret: "{Client Secret}"               # Update with azure Client Secret
    discoveryUri: "{azure Domain Name}/.well-known/openid-configuration"       # Update your Azure discovery URI
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
    bold="Azure"
    href="/deployment/security/azure" %}
    Go to Azure Configuration
  {% /inlineCallout %}
{% /inlineCalloutContainer %}
