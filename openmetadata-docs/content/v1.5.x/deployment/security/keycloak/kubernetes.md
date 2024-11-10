---
title: Keycloak SSO for Kubernetes
slug: /deployment/security/keycloak/kubernetes
collate: false
---

# Keycloak SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` is generated, see the snippet below for an example of where to
place the client id value and update the authorizer configurations in the `values.yaml`.

The configuration below already uses the presets shown in the example of keycloak configurations, you can change to yours.

```yaml
openmetadata:
  config:
    authorizer:
      className: "org.openmetadata.service.security.DefaultAuthorizer"
      containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
      initialAdmins:
        - "admin-user"
      principalDomain: "open-metadata.org"
    authentication:
      provider: "custom-oidc"
      publicKeys:
      - "https://{your domain}/api/v1/system/config/jwks" # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
      - "http://localhost:8081/auth/realms/data-sec/protocol/openid-connect/certs"
      authority: "http://localhost:8081/auth/realms/data-sec"
      clientId: "{Client ID}"
      callbackUrl: "https://{your domain}/callback"
```

{% note %}

`AUTHENTICATION_PUBLIC_KEYS` and `AUTHENTICATION_CALLBACK_URL` refers to https://{your domain} this is referring to your OpenMetdata installation domain name
and please make sure to correctly put http or https depending on your installation.

{% /note %}

{% note %}

Altering the order of claims in `jwtPrincipalClaims` may lead to problems when matching a user from a token with an existing user in the system. The mapping process relies on the specific order of claims, so changing it can result in inconsistencies or authentication failures, as the system cannot ensure correct user mapping with a new claim order.

{% /note %}

{% partial file="/v1.5/deployment/configure-ingestion.md" /%}
