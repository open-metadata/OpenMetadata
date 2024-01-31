---
title: Azure SSO for Bare Metal
slug: /deployment/security/azure/bare-metal
---

# Azure SSO for Bare Metal

Get the `Client Id` and `Tenant ID` from Azure Application configured in [Step 3](/deployment/security/azure#step-3-where-to-find-the-credentials).

Get the Azure Service Application `Client Id`, `Client Secret`, `Authority`, `Scopes` from the information collected in [Step 9](/deployment/security/azure#step-9-note-down-the-clientid-and-authority).

## Update conf/openmetadata.yaml

```yaml
authenticationConfiguration:
  provider: "azure"
  publicKeyUrls:
    - "https://login.microsoftonline.com/common/discovery/keys"
    - "http://{your openmetadata domain}/api/v1/config/jwks" # Update with your Domain and Make sure this "/api/v1/config/jwks" is always configured to enable JWT tokens
  authority: "https://login.microsoftonline.com/{Tenant ID}"
  clientId: "{Client ID}" # Azure Application
  callbackUrl: "http://localhost:8585/callback"
```

Then, 
- Update `authorizerConfiguration` to add login names of the admin users in `adminPrincipals` section as shown below.
- Update the `principalDomain` to your company domain name.

```yaml
authorizerConfiguration:
  className: "org.openmetadata.service.security.DefaultAuthorizer"
  # JWT Filter
  containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
  adminPrincipals:
    - "user1"
    - "user2"
  principalDomain: "open-metadata.org"
```

{% partial file="/v1.3/deployment/configure-ingestion.md" /%}
