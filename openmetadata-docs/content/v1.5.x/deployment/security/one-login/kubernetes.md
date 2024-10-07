---
title: OneLogin SSO for Kubernetes
slug: /deployment/security/one-login/kubernetes
collate: false
---

# One Login SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` is generated, see the snippet below for an example of where to
place the client id value and update the authorizer configurations in the `values.yaml`.

```yaml
openmetadata:
  config:
    authorizer:
      className: "org.openmetadata.service.security.DefaultAuthorizer"
      # JWT Filter
      containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
      initialAdmins: 
      - "suresh"
      principalDomain: "open-metadata.org"
    authentication:
      provider: "custom-oidc"
      publicKeys:
      - "https://{your domain}/api/v1/system/config/jwks" # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
      - "{IssuerUrl}/certs"
      authority: "{IssuerUrl}"
      clientId: "{client id}"
      callbackUrl: "https://{your domain}/callback"
```

{% note %}

`AUTHENTICATION_PUBLIC_KEYS` and `AUTHENTICATION_CALLBACK_URL` refers to https://{your domain} this is referring to your OpenMetdata installation domain name
and please make sure to correctly put http or https depending on your installation.

{% /note %}

{% partial file="/v1.5/deployment/configure-ingestion.md" /%}
