# Configure OpenMetadata Server

## Update conf/openmetadata.yaml

* Once the `Client Id` and `Client secret` are generated add the `Client Id` in openmetadata.yaml file in `client_id` field.

```
authenticationConfiguration:
  provider: "auth0"
  publicKeyUrls: 
    - "https://parth-panchal.us.auth0.com/.well-known/jwks.json"
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
