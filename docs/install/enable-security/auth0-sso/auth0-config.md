# Configure OpenMetadata Server

## Update conf/openmetadata-security.yaml

*   Once the `Client Id` and `Client secret` is generated.

    Add the `Client Id` in openmetadata-security.yaml file in `client_id` field.

```
authenticationConfiguration:
  provider: "auth0"
  publicKey: "https://parth-panchal.us.auth0.com/.well-known/jwks.json"
  authority: "https://parth-panchal.us.auth0.com/"
  clientId: "{Client Secret}"
  callbackUrl: "http://localhost:8585/callback"
```

* (Optional) Set the user principal fields

`authenticationConfiguration.jwtPrincipalClaims` - Sets fields of the access token used for the OpenMetadata user. First of these fields that is present in the token is used. Default is `['email', 'preferred_username', 'sub']`.

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
  prinicipalDomain: "open-metadata.org"
```
