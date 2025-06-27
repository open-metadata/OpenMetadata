---
title: Okta SSO for Kubernetes
slug: /deployment/security/okta/kubernetes
collate: false
---

# Okta SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Here is an example for reference, showing where to place the values in the `values.yaml` file after setting up your OKTA account and obtaining the application credentials.

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
      provider: "okta"
      publicKeys:
      - "{your domain}/api/v1/system/config/jwks"     # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
      - "{ISSUER_URL}/v1/keys"
      authority: "{ISSUER_URL}"    
      clientId: "{Client ID}"                 # Update your Client ID
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
      provider: "okta" 
      publicKeys:
      - "{your domain}/api/v1/system/config/jwks"         # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
      - "{ISSUER_URL}/v1/keys"
      authority: "{ISSUER_URL}"  
      clientId: "{Client ID}"                             # Update your Client ID
      callbackUrl: "http://localhost:8585/callback"
      oidcConfiguration:
        oidcType: "okta"  
        clientId:
          secretRef: oidc-secrets
          secretKey: openmetadata-oidc-client-id  
        clientSecret:
          secretRef: oidc-secrets
          secretKey: openmetadata-oidc-client-secret  
        discoveryUri: "http://{ISSUER_URL}/.well-known/openid-configuration"      # Update your Issuer URL
        callbackUrl: http://localhost:8585/callback  
        serverUrl: http://localhost:8585  
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