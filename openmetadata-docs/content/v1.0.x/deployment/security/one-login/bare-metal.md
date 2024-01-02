---
title: OneLogin SSO for Bare Metal
slug: /deployment/security/one-login/bare-metal
---

# OneLogin SSO for Bare Metal

## Update conf/openmetadata.yaml

Once the `Client Id` and `Client Secret` are generated add the `Client Id` in `openmetadata.yaml` file in `client_id` field.

Update the providerName config to the name you want to display in the `Sign In` button in the UI. 
For example, with the following configuration with `providerName` set to `OneLogin`, the users will see `Sign In with OneLogin SSO` 
in the `Sign In` page of the OpenMetadata UI.

{% note noteType="Warning" %}

It is important to leave the publicKeys configuration to have both OneLogin SSO public keys URL and OpenMetadata public keys URL. 

1. OneLogin SSO Public Keys are used to authenticate User's login
2. OpenMetadata JWT keys are used to authenticate Bot's login
3. Important to update the URLs documented in below configuration. The below config reflects a setup where all dependencies are hosted in a single host. Example openmetadata:8585 might not be the same domain you may be using in your installation.
4. OpenMetadata ships default public/private key, These must be changed in your production deployment to avoid any security issues.

For more details, follow [Enabling JWT Authentication](deployment/security/enable-jwt-tokens)

{% /note %}


```yaml
authenticationConfiguration:
  provider: "custom-oidc"
  providerName: "OneLogin"
  publicKeyUrls: 
    - "{IssuerUrl}/certs"
    - "http://openmetadata:8585/api/v1/system/config/jwks"
  authority: "{IssuerUrl}"
  clientId: "{client id}"
  callbackUrl: "http://localhost:8585/callback"
```

- Update `authorizerConfiguration` to add login names of the admin users in  section as shown below. Make sure you configure the name from email, example: xyz@helloworld.com, initialAdmins username will be ```xyz``
- Update the `principalDomain` to your company domain name.  Example from above, principalDomain should be ```helloworld.com```

```yaml
authorizerConfiguration:
  className: "org.openmetadata.service.security.DefaultAuthorizer"
  # JWT Filter
  containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
  adminPrincipals:
    - "user1"
    - "user2"
  principalDomain: "open-metadata.org"
```

{% note noteType="Tip" %}
 Follow [this guide](/how-to-guides/admin-guide/bots) to configure the `ingestion-bot` credentials for ingesting data using Connectors.
{% /note %}


