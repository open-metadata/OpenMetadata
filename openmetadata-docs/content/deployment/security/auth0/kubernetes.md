---
title: Auth0 SSO for Kubernetes
slug: /deployment/security/auth0/kubernetes
---

# Auth0 SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` and `Client Secret` are generated, see the snippet below for an example of where to
place the client id value and update the authorizer configurations in the `values.yaml`.

### Before 0.12.1

```yaml
global:
  authorizer:
    className: "org.openmetadata.service.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
    initialAdmins: 
    - "suresh"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "auth0"
    publicKeys: 
    - "{Auth0 Domain Name}/.well-known/jwks.json"
    authority: "https://parth-panchal.us.auth0.com/"
    clientId: "{Client ID}"
    callbackUrl: "http://localhost:8585/callback"
  airflow:
    openmetadata:
      authProvider: "auth0"
      authConfig:
        auth0:
          clientId: ""
          secretKey:
            secretRef: auth0-client-key-secret
            secretKey: auth0-client-key-secret
          domain: ""
```

### After 0.12.1

```yaml
global:
  authorizer:
    className: "org.openmetadata.service.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
    initialAdmins: 
    - "suresh"
    botPrincipals: 
    - "<client_id>"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "auth0"
    publicKeys: 
    - "{Auth0 Domain Name}/.well-known/jwks.json"
    authority: "https://parth-panchal.us.auth0.com/"
    clientId: "{Client ID}"
    callbackUrl: "http://localhost:8585/callback"
```

### After 0.13.0

```yaml
global:
  authorizer:
    className: "org.openmetadata.service.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
    initialAdmins: 
    - "suresh"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "auth0"
    publicKeys: 
    - "http://openmetadata:8585/api/v1/config/jwks"
    - "{Auth0 Domain Name}/.well-known/jwks.json"
    authority: "https://parth-panchal.us.auth0.com/"
    clientId: "{Client ID}"
    callbackUrl: "http://localhost:8585/callback"
```

**Note:** Follow [this](/how-to-guides/feature-configurations/bots) guide to configure the `ingestion-bot` credentials for
ingesting data from Airflow.
