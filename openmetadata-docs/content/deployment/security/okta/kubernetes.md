---
title: Okta SSO for Kubernetes
slug: /deployment/security/okta/kubernetes
---

# Okta SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` and `Client Secret` are generated, see the snippet below for an example of where to
place the client id value and update the authorizer configurations in the `values.yaml`.

```yaml
global:
  authorizer:
    className: "org.openmetadata.catalog.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
    initialAdmins:
      - "user1"
      - "user2"
    botPrincipals:
      - "<service_application_client_id>"
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
