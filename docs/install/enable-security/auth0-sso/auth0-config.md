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

* Update authorizerConfiguration to add adminPrincipals

```
authorizerConfiguration:
  className: "org.openmetadata.catalog.security.DefaultCatalogAuthorizer"
  # JWT Filter
  containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
  adminPrincipals:
    - "suresh"
  botPrincipals:
    - "ingestion-bot"
  prinicipalDomain: "open-metadata.org"
```
