# Configure OpenMetadata Helm

## Update Helm Values

Once the `client id` and `client secret` are generated, see the snippet below for an example of where to place the `client id` value and update authorizer configurations.

```
global:
  ...
  authorizer:
    className: "org.openmetadata.catalog.security.DefaultAuthorizer"
    # JWT Filter
    containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
    initialAdmin: "suresh"
    botPrincipal: "ingestion-bot"
  provider: "google"
  publicKeyUrls:
    provider: "google"
    - "https://www.googleapis.com/oauth2/v3/certs"
  authority: "https://accounts.google.com"
  clientId: "{client id}"
  callbackUrl: "http://localhost:8585/callback"
```

### Upgrade Helm Release

Head towards [upgrade-openmetadata-on-kubernetes.md](../../../../upgrade/upgrade-on-kubernetes/upgrade-openmetadata-on-kubernetes.md "mention") to upgrade your OpenMetadata Helm Release.
