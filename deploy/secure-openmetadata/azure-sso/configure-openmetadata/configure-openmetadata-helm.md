# Configure OpenMetadata Helm

## Update Helm Values

* Once the `client id` and `client secret` are generated, see the snippet below for an example of where to place the `client id` value and update the authorizer configurations.

```yaml
global:
  authorizer:
    className: "org.openmetadata.catalog.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
    initialAdmins: 
    - "suresh"
    botPrincipals: 
    - "<service_application_client_id>"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "azure"
    publicKeys: 
    - "https://login.microsoftonline.com/common/discovery/keys"
    authority: "https://login.microsoftonline.com/{Tenant ID}"
    clientId: "{Client ID}"
    callbackUrl: "http://localhost:8585/callback"
```

## Upgrade Helm Release

Head towards [Broken link](broken-reference "mention") to upgrade your OpenMetadata Helm Release.
