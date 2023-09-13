---
title: Amazon Cognito SSO for Bare Metal
slug: /deployment/security/amazon-cognito/bare-metal
---

# Amazon Cognito SSO for Bare Metal

## Update conf/openmetadata.yaml

Once the User pool and App client are created, add the `client id` to the value of the `clientId` field in the
`openmetadata.yaml` file. See the snippet below for an example of where to place the `client id` value. Also, configure the
`publicKeyUrls` and `authority` fields correctly with the User Pool ID from the previous step.

{% note noteType="Warning" %}

It is important to leave the publicKeys configuration to have both Amazon Cognito public keys URL and OpenMetadata public keys URL. 

1. Amazon Cognito SSO Public Keys are used to authenticate User's login
2. OpenMetadata JWT keys are used to authenticate Bot's login
3. Important to update the URLs documented in below configuration. The below config reflects a setup where all dependencies are hosted in a single host. Example openmetadata:8585 might not be the same domain you may be using in your installation.
4. OpenMetadata ships default public/private key, These must be changed in your production deployment to avoid any security issues.

For more details, follow [Enabling JWT Authenticaiton](deployment/security/enable-jwt-tokens)

{% /note %}


```yaml
authenticationConfiguration:
  provider: "aws-cognito"
  publicKeyUrls:
    - "https://cognito-idp.us-west-1.amazonaws.com/{User Pool ID}/.well-known/jwks.json"
    - "http://openmetadata:8585/api/v1/system/config/jwks"
  authority: "https://cognito-idp.us-west-1.amazonaws.com/{User Pool ID}"
  clientId: "{Client ID}"
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
 Follow [this guide](/how-to-guides/feature-configurations/bots) to configure the `ingestion-bot` credentials for ingesting data using Connectors.
{% /note %}
