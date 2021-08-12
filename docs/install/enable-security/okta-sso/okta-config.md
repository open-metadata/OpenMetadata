# Configure OpenMetadata Server

## Update conf/openmetadata-security.yaml

* Once the **Client Id**, **Client secret**, **issuer** and **audience** is generated.

  Add those details in openmetadata-security.yaml file in the respective field.

```text
authenticationConfiguration:
  provider: "google"
  publicKey: "https://www.googleapis.com/oauth2/v3/certs"
  authority: "https://accounts.google.com"
  clientId: "{Client Secret}"
  callbackUrl: "http://localhost:8585/callback"
```

* Update authorizationConfiguraiton to add adminPrincipals

```text
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


