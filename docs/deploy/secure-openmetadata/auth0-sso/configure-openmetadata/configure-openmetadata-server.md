# Configure OpenMetadata Server

## Update conf/openmetadata-security.yaml

Once the `client id` and `client secret` are generated, add the  `client id` as the value of the `clientId` field in the openmetadata-security.yaml file. See the snippet below for an example of where to place the `client id` value.

```
authenticationConfiguration:
  provider: "auth0"
  publicKey: "https://parth-panchal.us.auth0.com/.well-known/jwks.json"
  authority: "https://parth-panchal.us.auth0.com/"
  clientId: "{Client ID}"
  callbackUrl: "http://localhost:8585/callback"
```

* Update authorizerConfiguration to add adminPrincipals

```
authorizerConfiguration:
  className: "org.openmetadata.catalog.security.DefaultAuthorizer"
  # JWT Filter
  containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
  adminPrincipals:
    - "suresh"
  botPrincipals:
    - "ingestion-bot"
  principalDomain: "open-metadata.org"
```
