# Configure OpenMetadata Helm

## Update Helm Values

* **ISSUER\_URL** - This can be found in **Security -> API -> Authorization Servers**.

![](<../../../../.gitbook/assets/image (31) (1) (1).png>)

* **CLIENT\_ID - SPA APP** - This is the Client\_ID for Single Page Applications. On configuring the app, the Client\_ID can be found in the **General** section, under **Client Credentials >> Client ID**

![](<../../../../.gitbook/assets/image (60) (1).png>)

Update `authorizerConfiguration` to add `adminPrincipals`

* For `adminPrincipals`, add the **Username**.
* For `botPrincipals`, add the **Ingestion Client ID** for the Service application. This can be found in **Okta -> Applications -> Applications**.

![](<../../../../.gitbook/assets/image (35) (1).png>)

```yaml
global:
  authorizer:
    className: "org.openmetadata.catalog.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
    initialAdmins: 
    - "<username>"
    botPrincipals: 
    - "<Ingestion Client ID>"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "okta"
    publicKeys: 
    - "{ISSUER_URL}/v1/keys"
    authority: "{ISSUER_URL}"
    clientId: "{CLIENT_ID - SPA APP}"
    callbackUrl: "http://localhost:8585/callback"
```

## Upgrade Helm Release

Head towards [upgrade-openmetadata-on-kubernetes.md](../../../../upgrade/upgrade-on-kubernetes/upgrade-openmetadata-on-kubernetes.md "mention") to upgrade your OpenMetadata Helm Release.
