---
title: Keycloak SSO for Kubernetes
slug: /deployment/security/keycloak/kubernetes
---

# Keycloak SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` and `Client Secret` are generated, see the snippet below for an example of where to
place the client id value and update the authorizer configurations in the `values.yaml`.

Create a secret in kubernetes with the client secret:
```shell
kubectl create secret generic custom-oidc-key-secret --namespace=dev-open-metadata --from-literal=custom-oidc-key-secret=<change-for-your-secret>
```

The configuration below already uses the presets shown in the example of keycloak configurations, you can change to yours.

### Before 0.12.1

```yaml
global:
  authorizer:
    className: "org.openmetadata.service.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
    initialAdmins:
      - "admin-user"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "custom-oidc"
    publicKeys:
      - "http://localhost:8081/auth/realms/data-sec/protocol/openid-connect/certs"
    authority: "http://localhost:8081/auth/realms/data-sec"
    clientId: "{Client ID}"
    callbackUrl: "http://localhost:8585/callback"
  airflow:
    openmetadata:
      authProvider: "custom-oidc"
      customOidc:
        clientId: "open-metadata"
        secretKey:
          secretRef: custom-oidc-key-secret
          secretKey: custom-oidc-key-secret
        tokenEndpoint: "http://localhost:8081/realms/data-sec/protocol/openid-connect/token"
```

### After 0.12.1

```yaml
global:
  authorizer:
    className: "org.openmetadata.service.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
    initialAdmins:
      - "admin-user"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "custom-oidc"
    publicKeys:
      - "http://localhost:8081/auth/realms/data-sec/protocol/openid-connect/certs"
    authority: "http://localhost:8081/auth/realms/data-sec"
    clientId: "{Client ID}"
    callbackUrl: "http://localhost:8585/callback"
```

**Note:** Follow [this](/how-to-guides/feature-configurations/bots) guide to configure the `ingestion-bot` credentials for
ingesting data from Airflow.