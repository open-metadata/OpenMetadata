---
title: Auth0 SSO for Kubernetes
slug: /deployment/security/auth0/kubernetes
---

# Auth0 SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` and `Client Secret` are generated, see the snippet below for an example of where to
place the client id value and update the authorizer configurations in the `values.yaml`.

```yaml
openmetadata:
  config:
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

{% partial file="/v1.2/deployment/configure-ingestion.md" /%}
