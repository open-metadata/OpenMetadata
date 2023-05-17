---
title: Amazon Cognito SSO for Kubernetes
slug: /deployment/security/amazon-cognito/kubernetes
---

# Amazon Cognito SSO for Kubernetes

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
    provider: "google"
    publicKeys:
      - "https://www.googleapis.com/oauth2/v3/certs"
    authority: "https://accounts.google.com"
    clientId: "{client id}"
    callbackUrl: "http://localhost:8585/callback"
```

Finally, update the Airflow information with the JWT token
from [Enabling JWT Tokens](/deployment/security/enable-jwt-tokens).
