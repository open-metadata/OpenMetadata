---
title: Custom OIDC SSO for Bare Metal | Official Documentation
description: Use custom OIDC authentication on bare-metal environments to support identity federation and secure access without cloud dependencies.
slug: /deployment/security/custom-oidc/bare-metal
collate: false
---

# Custom OIDC SSO for Bare Metal

## Update conf/openmetadata.yaml

Once the `Client Id` is generated, add the `Client Id` in `openmetadata.yaml` file in `client_id` field.

Update the `providerName` config to the name you want to display in the `Sign In` button in the UI. For example, with the
following configuration with `providerName` set to `KeyCloak`, the users will see `Sign In with KeyCloak SSO` in the `Sign In`
page of the OpenMetadata UI.

```yaml
authenticationConfiguration:
  provider: "custom-oidc"
  providerName: "KeyCloak"
  publicKeyUrls:
    - "http://localhost:8080/realms/myrealm/protocol/openid-connect/certs"
    - "{your domain}/api/v1/system/config/jwks" # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
  authority: "http://localhost:8080/realms/myrealm"
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

### Troubleshooting

* If you are seeing the below trace in the logs, you need to add the discovery URL

```
org.pac4j.core.exception.TechnicalException: You must define either the discovery URL or directly the provider metadata
```

To resolve the error regarding the discovery URL, you need to set the `AUTHENTICATION_DISCOVERY_URI` in your configuration. This URI is used to discover the OpenID Connect provider's configuration.
