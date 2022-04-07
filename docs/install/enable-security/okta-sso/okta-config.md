# Configure OpenMetadata Server

## Update conf/openmetadata-security.yaml

* Once the **Client Id**, **Client secret**, **issuer,** and the **audience** are generated, add those details in `openmetadata-security.yaml` file in the respective field.

```
authenticationConfiguration:
  provider: "okta"
  publicKeyUrls:
    - "https://{okta_domain}/oauth2/default/v1/keys"
  authority: "{okta_domain}"
  clientId: "{Client Secret}"
  callbackUrl: "http://localhost:8585/callback"
```

* (Optional) Set the user principal fields

`authenticationConfiguration.jwtPrincipalClaims` - Sets fields of the access token used for the OpenMetadata user. First of these fields that is present in the token is used. Default is `['email', 'preferred_username', 'sub']`.

* Update `authorizerConfiguration` to add `adminPrincipals`

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
