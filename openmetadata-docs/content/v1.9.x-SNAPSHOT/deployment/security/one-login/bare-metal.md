---
title: OneLogin SSO for Bare Metal
slug: /deployment/security/one-login/bare-metal
collate: false
---

# OneLogin SSO for Bare Metal

## Update conf/openmetadata.yaml

Once the `Client Id` is generated, add the `Client Id` in `openmetadata.yaml` file in `client_id` field.

Update the providerName config to the name you want to display in the `Sign In` button in the UI. 
For example, with the following configuration with `providerName` set to `OneLogin`, the users will see `Sign In with OneLogin SSO` 
in the `Sign In` page of the OpenMetadata UI.

```yaml
authenticationConfiguration:
  provider: "custom-oidc"
  providerName: "OneLogin"
  publicKeyUrls: 
    - "{IssuerUrl}/certs"
    - "{your domain}/api/v1/system/config/jwks" # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
  authority: "{IssuerUrl}"
  clientId: "{client id}"
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

{% partial file="/v1.9/deployment/configure-ingestion.md" /%}
