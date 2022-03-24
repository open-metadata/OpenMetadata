# Configure OpenMetadata Server

## Update conf/openmetadata-security.yaml

* Once the `client id` and `client secret` are generated, add `client id` as the value of the `clientId` field in the openmetadata-security.yaml file. See the snippet below for an example of where to place the `client id` value.

```
authenticationConfiguration:
  provider: "google"
  publicKey: "https://www.googleapis.com/oauth2/v3/certs"
  authority: "https://accounts.google.com"
  clientId: "{client id}"
  callbackUrl: "http://localhost:8585/callback"
```

* (Optional) Set the user principal fields

`authenticationConfiguration.jwtPrincipalClaims` - Sets fields of the access token used for the OpenMetadata user. First of these fields that is present in the token is used. Default is `['email', 'preferred_username', 'sub']`.

* Then, update authorizerConfiguration to add adminPrincipals.

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
