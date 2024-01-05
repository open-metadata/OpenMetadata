---
title: Okta SSO for Kubernetes
slug: /deployment/security/okta/kubernetes
---

# Okta SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` and `Client Secret` are generated, see the snippet below for an example of where to
place the client id value and update the authorizer configurations in the `values.yaml`.

This can be found in Okta -> Applications -> Applications, Refer to Step 3 for `Creating Service Application`.

```yaml
openmetadata:
  config:
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
      - "http://{your openmetadata domain}/api/v1/system/config/jwks" # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
      - "{ISSUER_URL}/v1/keys"
      authority: "{ISSUER_URL}"
      clientId: "{CLIENT_ID - SPA APP}"
      callbackUrl: "http://localhost:8585/callback"
```

{% partial file="/v1.2/deployment/configure-ingestion.md" /%}
