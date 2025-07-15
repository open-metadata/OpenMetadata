---
title: Auth0 SSO for Bare Metal | Official Documentation
description: Connect Bare Metal to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /deployment/security/auth0/bare-metal
collate: false
---

# Auth0 SSO for Bare Metal

## Update conf/openmetadata.yaml


In `openmetadata.yaml` file and use the following example as a reference. Replace the placeholder values with the details generated during your Auth0 account and application credentials setup.

Check the more information about environment variable [here](/deployment/security/configuration-parameters).


{% codeWithLanguageSelector title="Auth Configuration" id="container-1" languagesArray=["implicit","authcode"] theme="dark" %}
```implicit
# Implicit Flow Configuration
authorizerConfiguration:
  className: "org.openmetadata.service.security.DefaultAuthorizer"
  containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
  adminPrincipals:                          
    - "admin"                                               # Administrator email prefix (e.g., "admin" from "admin@domain.com")
    - "user1"                                               # Additional administrator email prefix
    - "user2"                                               # Additional administrator email prefix
  principalDomain: "open-metadata.org"                      # Primary domain for your organization (e.g., "yourdomain.com") 
      principalDomain: "open-metadata.org"  # Update with your Domain,The primary domain for the organization (example.com from john.doe@example.com).  
authenticationConfiguration:
  provider: "auth0"                                         # Authentication provider, set to "auth0"
  publicKeyUrls:                           
    - "https://{Auth0 Domain Name}/.well-known/jwks.json"   # Replace {Auth0 Domain Name} with your Auth0 domain
    - "{Your OMD Server URL}/api/v1/system/config/jwks"     # Replace {Your OMD Server URL} with your OpenMetadata server URL
  authority: "https://{Your Auth0 Domain}"                  # Base URL of your Auth0 domain
  clientId: "{Client ID}"                                   # Auth0 Client ID for your application
  callbackUrl: "http://localhost:8585/callback"             # Callback URL for OpenMetadata authentication
  clientType: "public"                                      # Set to "public" for implicit flow
```
```authcode
# Auth Code Flow Configuration
authorizerConfiguration:
  className: "org.openmetadata.service.security.DefaultAuthorizer"
  containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
  adminPrincipals:                          
    - "admin"                                                   # Administrator email prefix (e.g., "admin" from "admin@domain.com")
    - "user1"                                                   # Additional administrator email prefix
    - "user2"                                                   # Additional administrator email prefix
  principalDomain: "open-metadata.org"                          # Primary domain for your organization (e.g., "yourdomain.com")
authenticationConfiguration:
  provider: "auth0"                                             # Authentication provider, set to "auth0"
  publicKeyUrls:                           
    - "https://{Auth0 Domain Name}/.well-known/jwks.json"       # Replace {Auth0 Domain Name} with your Auth0 domain
    - "{Your OMD Server URL}/api/v1/system/config/jwks"         # Replace {Your OMD Server URL} with your OpenMetadata server URL
  authority: "https://{Your Auth0 Domain}"                      # Base URL of your Auth0 domain
  clientId: "{Client ID}"                                       # Auth0 Client ID for your application
  callbackUrl: "http://localhost:8585/callback"                 # Callback URL for OpenMetadata authentication
  clientType: "confidential"                                    # Set to "confidential" for auth code flow
  oidcConfiguration:
    id: "{Client ID}"                                           # Auth0 Client ID for your application
    type: "auth0"                                               # Ensure this matches your provider type
    secret: "{Client Secret}"                                   # Auth0 Client Secret for your application
    discoveryUri: "https://{Auth0 Domain Name}/.well-known/openid-configuration" 
                                                                # Discovery URI for OpenID configuration; replace {Auth0 Domain Name} with your Auth0 domain
    callbackUrl: "http://localhost:8585/callback"               # Callback URL for OpenMetadata authentication
                                                                
    serverUrl: "http://localhost:8585"                          # OpenMetadata server URL; update for production environments
```
{% /codeWithLanguageSelector %}

{% partial file="/v1.9/deployment/configure-ingestion.md" /%}

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="MdArrowBack"
    bold="Auth"
    href="/deployment/security/auth0" %}
    Go to Auth0 Configuration
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

