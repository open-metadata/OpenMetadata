# Configure OpenMetadata Helm

## Update Helm Values

Once the `client id` and `client secret` are generated, see the snippet below for an example of where to place the `client id` value and update authorizer configurations.

```yaml
global:
  authorizer:
    className: "org.openmetadata.catalog.security.DefaultAuthorizer"
    # JWT Filter
    containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
    initialAdmins: 
    - "suresh"
    botPrincipals: 
    - "ingestion-bot"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "custom-oidc"
    publicKeys: 
    - "http://localhost:8081/realms/myrealm/protocol/openid-connect/certs"
    authority: "http://localhost:8081/realms/myrealm"
    clientId: "{client id}"
    callbackUrl: "http://localhost:8585/callback"
```

## Upgrade Helm Release

Head towards [upgrade-openmetadata-on-kubernetes.md](../../../../upgrade/upgrade-on-kubernetes/upgrade-openmetadata-on-kubernetes.md "mention") to upgrade your OpenMetadata Helm Release.
