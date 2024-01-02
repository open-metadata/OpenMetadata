---
title: Keycloak SSO for Bare Metal
slug: /deployment/security/keycloak/bare-metal
---

# Keycloak SSO for Bare Metal

## Update conf/openmetadata.yaml

Once the `Client Id` and `Client Secret` are generated add the `Client Id` in `openmetadata.yaml` file in `client_id` field.

Update the `providerName` config to the name you want to display in the `Sign In` button in the UI. For example, with the
following configuration with `providerName` set to `KeyCloak`, the users will see `Sign In with KeyCloak SSO` in the `Sign In`
page of the OpenMetadata UI.

The configuration below already uses the presets shown in the example of keycloak configurations, you can change to yours.
```yaml
authenticationConfiguration:
  provider: "custom-oidc"
  providerName: "KeyCloak"
  publicKeyUrls:
    - "http://localhost:8081/auth/realms/data-sec/protocol/openid-connect/certs"
  authority: "http://localhost:8081/auth/realms/data-sec"
  clientId: "open-metadata"
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
    - "admin-user"
  principalDomain: "open-metadata.org"
```

{% partial file="/v1.1/deployment/configure-ingestion.md" /%}
