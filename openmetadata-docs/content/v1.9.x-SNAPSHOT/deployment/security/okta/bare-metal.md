---
title: Okta SSO for Bare Metal | Official Documentation
description: Connect Bare Metal to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /deployment/security/okta/bare-metal
collate: false
---

# Okta SSO for Bare Metal

## Update conf/openmetadata.yaml

In `openmetadata.yaml` file and use the following example as a reference. Replace the placeholder values with the details generated during your Okta account and application credentials setup.


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
  provider: "okta" 
  publicKeyUrls:
    - "{ISSUER_URL}/v1/keys"
    - "{your domain}/api/v1/system/config/jwks" # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
  authority: "{ISSUER_URL}"
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
  provider: "okta" 
  publicKeyUrls:
    - "{ISSUER_URL}/v1/keys"
    - "{your domain}/api/v1/system/config/jwks"             # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
  authority: "{ISSUER_URL}"                                 # Update Okta Issuer URL
  clientId: "{Client ID}"                                   # Update Okta Client ID
  callbackUrl: "http://localhost:8585/callback"
  clientType: "confidential"
  oidcConfiguration:
    id: "{Client ID}"                                       # Update you Okta Client ID
    type: "okta"     
    secret: "{Client Secret}"                               # Update with Okta Client Secret
    discoveryUri: "http://{ISSUER_URL}/.well-known/openid-configuration"      # Update your Issuer URL    
    callbackUrl: http://localhost:8585/callback"
    serverUrl: "http://localhost:8585"
```
{% /codeWithLanguageSelector %}

{% partial file="/v1.9/deployment/configure-ingestion.md" /%}

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="MdArrowBack"
    bold="OKTA"
    href="/deployment/security/okta" %}
    Go to okta Configuration
  {% /inlineCallout %}
{% /inlineCalloutContainer %}
