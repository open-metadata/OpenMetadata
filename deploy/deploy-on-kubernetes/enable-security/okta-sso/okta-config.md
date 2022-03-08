# Copy of Configure OpenMetadata Server

## Update conf/openmetadata-security.yaml

* Once the **Client Id**, and **Issuer URL** are generated, add those details in `openmetadata-security.yaml` file in the respective fields.

```yaml
authenticationConfiguration:
  provider: "okta"
  publicKey: "{ISSUER_URL}/v1/keys"
  authority: "{ISSUER_URL}"
  clientId: "{CLIENT_ID - SPA APP}"
  callbackUrl: "http://localhost:8585/callback"
```

* Update `authorizerConfiguration` to add `adminPrincipals`

```yaml
authorizerConfiguration:
  className: "org.openmetadata.catalog.security.DefaultAuthorizer"
  containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
  adminPrincipals:
    - "<username>"
  botPrincipals:
    - "ingestion-bot"
    - "<Ingestion Client ID>"
  principalDomain: "open-metadata.org"
```
