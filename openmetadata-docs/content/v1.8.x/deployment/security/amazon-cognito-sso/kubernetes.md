---
title: Amazon Cognito SSO for Kubernetes | Official Documentation
description: Use Amazon Cognito with Kubernetes to secure user access across distributed containerized apps using token-based authentication workflows.
slug: /deployment/security/amazon-cognito/kubernetes
collate: false
---

# Amazon Cognito SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` is generated, see the snippet below for an example of where to
place the client id value and update the authorizer configurations in the `values.yaml`.

```yaml
openmetadata:
  config:
    authorizer:
      className: "org.openmetadata.service.security.DefaultAuthorizer"
      containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
      initialAdmins:
        - "admin"
      principalDomain: "open-metadata.org"
    authentication:
      provider: "aws-cognito"
      publicKeys:
        - "{your domain}/api/v1/system/config/jwks"
        - "{Cognito Domain}/{User Pool ID}/.well-known/jwks.json" # Update with your Cognito Domain and User Pool ID
      authority: "{Cognito Domain}/{User Pool ID}" # Update with your Cognito Domain and User Pool ID as follows - https://cognito-idp.us-west-1.amazonaws.com/us-west-1_DL8xfTzj8
      clientId: "{Client ID}" # Update with your Client ID
      callbackUrl: "http://localhost:8585/callback"
```

{% partial file="/v1.8/deployment/configure-ingestion.md" /%}
