# Configure OpenMetadata Server

## Update conf/openmetadata-security.yaml

* Once the `Client Id` and `Client secret` is generated.

  Add the `Client Id` in openmetadata-security.yaml file in `client_id` field.

```text
authenticationConfiguration:
  provider: "google"
  publicKey: "https://www.googleapis.com/oauth2/v3/certs"
  authority: "https://accounts.google.com"
  clientId: "{Client Secret}"
  callbackUrl: "http://localhost:8585/callback"
```

* Update authorizerConfiguration to add adminPrincipals

```text
authorizerConfiguration:
  className: "org.openmetadata.catalog.security.DefaultCatalogAuthorizer"
  # JWT Filter
  containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
  adminPrincipals:
    - "suresh"
  botPrincipals:
    - "ingestion-bot"
  principalDomain: "open-metadata.org"
```

