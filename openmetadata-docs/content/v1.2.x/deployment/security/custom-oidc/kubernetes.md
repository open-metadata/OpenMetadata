---
title: Custom OIDC SSO for Kubernetes
slug: /deployment/security/custom-oidc/kubernetes
---

# Custom OIDC SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` and `Client Secret` are generated, see the snippet below for an example of where to
place the client id value and update the authorizer configurations in the `values.yaml`.

```yaml
global:
  authorizer:
    className: "org.openmetadata.service.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
    initialAdmins:
      - "user1"
      - "user2"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "custom-oidc"
    publicKeys:
    - "http://{your openmetadata domain}/api/v1/system/config/jwks" # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
    - "http://localhost:8080/realms/myrealm/protocol/openid-connect/certs"
    authority: "http://localhost:8080/realms/myrealm"
    clientId: "{Client ID}"
    callbackUrl: "http://localhost:8585/callback"
```

{% partial file="/v1.2/deployment/configure-ingestion.md" /%}
