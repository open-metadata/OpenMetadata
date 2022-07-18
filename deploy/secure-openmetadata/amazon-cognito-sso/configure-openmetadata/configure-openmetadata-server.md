# Configure OpenMetadata Server

## Update conf/openmetadata.yaml

Once the User pool and App client are created, add the `client id` to the value of the `clientId` field in the openmetadata.yaml file. See the snippet below for an example of where to place the `client id` value. Also, configure the `publicKeyUrls` and `authority` fields correctly with the `User Pool ID` from the previous step.

```
authenticationConfiguration:
  provider: "aws-cognito"
  publicKeyUrls: 
    - "https://cognito-idp.us-west-1.amazonaws.com/{User Pool ID}/.well-known/jwks.json"
  authority: "https://cognito-idp.us-west-1.amazonaws.com/{User Pool ID}"
  clientId: "{Client ID}"
  callbackUrl: "http://localhost:8585/callback"
```

Then,

* Update `authorizerConfiguration` to add login names of the admin users in `adminPrincipals` section as shown below.
* Update the `principalDomain` to your company domain name.

```
authorizerConfiguration:
  className: "org.openmetadata.catalog.security.DefaultAuthorizer"
  # JWT Filter
  containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
  adminPrincipals:
    - "user1"
    - "user2"
  botPrincipals:
    - "ingestion-bot"
  principalDomain: "open-metadata.org"
```
