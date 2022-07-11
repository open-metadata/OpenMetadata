---
title: Google SSO for Kubernetes
slug: /deployment/security/google/kubernetes
---

# Google SSO for Kubernetes

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
    provider: "azure"
    publicKeys:
      - "https://login.microsoftonline.com/common/discovery/keys"
    authority: "https://login.microsoftonline.com/{Tenant ID}"
    clientId: "{Client ID}"
    callbackUrl: "http://localhost:8585/callback"
  airflow:
    openmetadata:
      authProvider: "azure"
      azure:
        clientSecret:
          secretRef: azure-client-secret
          secretKey: azure-client-secret
        authority: ""
        scopes: [ ]
        clientId: ""
```
