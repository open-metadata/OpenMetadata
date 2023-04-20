---
title: Okta SSO for Kubernetes
slug: /deployment/security/okta/kubernetes
---

# Okta SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` and `Client Secret` are generated, see the snippet below for an example of where to
place the client id value and update the authorizer configurations in the `values.yaml`.

This can be found in Okta -> Applications -> Applications, Refer to Step 3 for `Creating Service Application`.

### Before 0.12.1

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
    provider: "okta"
    publicKeys:
      - "{ISSUER_URL}/v1/keys"
    authority: "{ISSUER_URL}"
    clientId: "{CLIENT_ID - SPA APP}"
    callbackUrl: "http://localhost:8585/callback"
  airflow:
    openmetadata:
      authProvider: "okta"
      okta:
        clientId: ""
        orgUrl: ""
        privateKey:
          secretRef: okta-client-private-key-secret
          secretKey: okta-client-private-key-secret
        email: ""
        scopes: [ ]
```

### After 0.12.1

```yaml
global:
  authorizer:
    className: "org.openmetadata.service.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
    initialAdmins:
      - "user1"
      - "user2"
    botPrincipals:
      - ingestion-bot
      - "<service_application_client_id>"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "okta"
    publicKeys:
      - "{ISSUER_URL}/v1/keys"
    authority: "{ISSUER_URL}"
    clientId: "{CLIENT_ID - SPA APP}"
    callbackUrl: "http://localhost:8585/callback"
```

### After 0.13.0

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
    provider: "okta"
    publicKeys:
    - "http://openmetadata:8585/api/v1/config/jwks"
    - "{ISSUER_URL}/v1/keys"
    authority: "{ISSUER_URL}"
    clientId: "{CLIENT_ID - SPA APP}"
    callbackUrl: "http://localhost:8585/callback"
```

**Note:** Follow [this](/how-to-guides/feature-configurations/bots) guide to configure the `ingestion-bot` credentials for
ingesting data from Airflow.