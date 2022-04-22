# Configure OpenMetadata Helm

## Update Helm Values

* Once the `client id` and `client secret` are generated, see the snippet below for an example of where to place the `client id` value and update the authorizer configurations.

```
global:
  authorizer:
    className: "org.openmetadata.catalog.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
    initialAdmin: "suresh"
    botPrincipal: "ingestion-bot"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "azure"
    publicKey: "https://login.microsoftonline.com/common/discovery/keys"
    authority: "https://login.microsoftonline.com/{Tenant ID}"
    clientId: "{Client ID}"
    callbackUrl: "http://localhost:8585/callback"
```

## Upgrade Helm Release

Head towards [upgrade-openmetadata-on-kubernetes.md](../../../../../upgrade/upgrade-on-kubernetes/upgrade-openmetadata-on-kubernetes.md "mention") to upgrade your OpenMetadata Helm Release.
