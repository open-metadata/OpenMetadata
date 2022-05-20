# Configure OpenMetadata Server

## Update conf/openmetadata.yaml

Once the `client id` and `client secret` are generated, add `client id` as the value of the `clientId` field in the openmetadata.yaml file. See the snippet below for an example of where to place the `client id` value.

Update the `providerName` config to the name you want to display in the `Sign In` button in the UI. For example, with the following configuration with `providerName` set to `KeyCloak`, the users will see `Sign In with KeyCloak SSO` in the Sign In page of the OpenMetadata UI.

```
authenticationConfiguration:
  provider: "custom-oidc"
  providerName: "KeyCloak"
  publicKeyUrls: 
    - "http://localhost:8080/realms/myrealm/protocol/openid-connect/certs"
  authority: "http://localhost:8080/realms/myrealm"
  clientId: "{client id}"
  callbackUrl: "http://localhost:8585/callback"
```

Then, update authorizerConfiguration to add adminPrincipals.

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
