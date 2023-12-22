---
title: Okta SSO for Kubernetes
slug: /deployment/security/okta/kubernetes
---

# Okta SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` and `Client Secret` are generated, see the snippet below for an example of where to
place the client id value and update the authorizer configurations in the `values.yaml`.

This can be found in Okta -> Applications -> Applications, Refer to Step 3 for `Creating Service Application`.

- Update `initialAdmins` Make sure you configure the name from email, example: xyz@helloworld.com, initialAdmins username will be ```xyz```

- Update the `principalDomain` to your company domain name. Example from above, principalDomain should be ```helloworld.com```

{% note noteType="Warning" %}

It is important to leave the publicKeys configuration to have both Amazon Cognito public keys URL and OpenMetadata public keys URL. 

1. Amazon Cognito Public Keys are used to authenticate User's login
2. OpenMetadata JWT keys are used to authenticate Bot's login
3. Important to update the URLs documented in below configuration. The below config reflects a setup where all dependencies are hosted in a single host. Example openmetadata:8585 might not be the same domain you may be using in your installation.
4. OpenMetadata ships default public/private key, These must be changed in your production deployment to avoid any security issues.

For more details, follow [Enabling JWT Authentication](deployment/security/enable-jwt-tokens)

{% /note %}


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
    provider: "okta"
    publicKeys:
    - "http://openmetadata:8585/api/v1/system/config/jwks"
    - "{ISSUER_URL}/v1/keys"
    authority: "{ISSUER_URL}"
    clientId: "{CLIENT_ID - SPA APP}"
    callbackUrl: "http://localhost:8585/callback"
```

{% note noteType="Tip" %}
 Follow [this guide](/how-to-guides/admin-guide/bots) to configure the `ingestion-bot` credentials for ingesting data using Connectors.
{% /note %}