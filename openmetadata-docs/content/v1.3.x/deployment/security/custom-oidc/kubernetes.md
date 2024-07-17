---
title: Custom OIDC SSO for Kubernetes
slug: /deployment/security/custom-oidc/kubernetes
---

# Custom OIDC SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` is generated, see the snippet below for an example of where to
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
    - "{your domain}/api/v1/system/config/jwks" # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
    - "http://localhost:8080/realms/myrealm/protocol/openid-connect/certs"
    authority: "http://localhost:8080/realms/myrealm"
    clientId: "{Client ID}"
    callbackUrl: "http://localhost:8585/callback"
```

{% partial file="/v1.3/deployment/configure-ingestion.md" /%}

### Troubleshooting

* If you are seeing the below trace in the logs, you need to add the discovery URL

```
org.pac4j.core.exception.TechnicalException: You must define either the discovery URL or directly the provider metadata
```

To resolve the error regarding the discovery URL, you need to set the `AUTHENTICATION_DISCOVERY_URI` in your configuration. This URI is used to discover the OpenID Connect provider's configuration.
