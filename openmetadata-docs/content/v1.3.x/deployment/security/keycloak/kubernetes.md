---
title: Keycloak SSO for Kubernetes
slug: /deployment/security/keycloak/kubernetes
---

# Keycloak SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` is generated, see the snippet below for an example of where to
place the client id value and update the authorizer configurations in the `values.yaml`.

The configuration below already uses the presets shown in the example of keycloak configurations, you can change to yours.

```yaml
openmetadata:
  config:
    authorizer:
      className: "org.openmetadata.service.security.DefaultAuthorizer"
      containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
      initialAdmins:
        - "admin-user"
      principalDomain: "open-metadata.org"
    authentication:
      provider: "custom-oidc"
      publicKeys:
      - "{your domain}/api/v1/system/config/jwks" # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
      - "http://localhost:8081/auth/realms/data-sec/protocol/openid-connect/certs"
      authority: "http://localhost:8081/auth/realms/data-sec"
      clientId: "{Client ID}"
      callbackUrl: "http://localhost:8585/callback"
```

{% partial file="/v1.3/deployment/configure-ingestion.md" /%}
