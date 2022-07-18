# Configure OpenMetadata Helm

## Update Helm Values

* Once the User pool and App client are created, add the `client id` to the value of the `clientId` field in the openmetadata.yaml file. See the snippet below for an example of where to place the `client id` value. Also, configure the `publicKeyUrls` and `authority` fields correctly with the `User Pool ID` from the previous step.

```yaml
global:
  authorizer:
    className: "org.openmetadata.catalog.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
    initialAdmins: 
    - "admin"
    botPrincipals: 
    - "ingestion-bot"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "aws-cognito"
    publicKeys: 
    - "https://cognito-idp.us-west-1.amazonaws.com/{User Pool ID}/.well-known/jwks.json"
    authority: "https://cognito-idp.us-west-1.amazonaws.com/{User Pool ID}"
    clientId: "{Client ID}"
    callbackUrl: "http://localhost:8585/callback"
```

## Upgrade Helm Release

Head towards [upgrade-openmetadata-on-kubernetes.md](../../../../upgrade/upgrade-on-kubernetes/upgrade-openmetadata-on-kubernetes.md "mention") to upgrade your OpenMetadata Helm Release.
