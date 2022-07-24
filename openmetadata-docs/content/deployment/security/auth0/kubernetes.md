---
title: Auth0 SSO for Kubernetes
slug: /deployment/security/auth0/kubernetes
---

# Auth0 SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` and `Client Secret` are generated, see the snippet below for an example of where to
place the client id value and update the authorizer configurations in the `values.yaml`.

```yaml
global:
  authorizer:
    className: "org.openmetadata.catalog.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
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
