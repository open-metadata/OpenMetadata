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
      - "admin"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "aws-cognito"
    publicKeys:
      - "http://openmetadata:8585/api/v1/config/jwks"
      - "{Cognito Domain}/{User Pool ID}/.well-known/jwks.json" # Update with your Cognito Domain and User Pool ID
    authority: "{Cognito Domain}/{User Pool ID}" # Update with your Cognito Domain and User Pool ID as follows - https://cognito-idp.us-west-1.amazonaws.com/us-west-1_DL8xfTzj8
    clientId: "{Client ID}" # Update with your Client ID
    callbackUrl: "http://localhost:8585/callback"
```

Finally, update the Airflow information with the JWT token
from [Enabling JWT Tokens](/deployment/security/enable-jwt-tokens).
