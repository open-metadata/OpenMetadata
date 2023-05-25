---
title: workflow config auth
slug: /deployment/security/workflow-config-auth
---

### Workflow Configs for Security Providers

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/security/client).
You can find the different implementation of the ingestion below.

#### Auth0 SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: auth0
    securityConfig:
      clientId: "{your_client_id}"
      secretKey: "{your_client_secret}"
      domain: "{your_domain}"
```

#### Azure SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: azure
    securityConfig:
      clientSecret: "{your_client_secret}"
      authority: "{your_authority_url}"
      clientId: "{your_client_id}"
      scopes:
        - your_scopes
```

#### Custom OIDC SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: custom-oidc
    securityConfig:
      clientId: "{your_client_id}"
      secretKey: "{your_client_secret}"
      domain: "{your_domain}"
```

#### Google SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: google
    securityConfig:
      secretKey: "{path-to-json-creds}"
```

#### Okta SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: okta
    securityConfig:
      clientId: "{CLIENT_ID - SPA APP}"
      orgURL: "{ISSUER_URL}/v1/token"
      privateKey: "{public/private keypair}"
      email: "{email}"
      scopes:
        - token
```

#### Amazon Cognito SSO

The ingestion can be configured by [Enabling JWT Tokens](https://docs.open-metadata.org/deployment/security/enable-jwt-tokens)

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: auth0
    securityConfig:
      clientId: "{your_client_id}"
      secretKey: "{your_client_secret}"
      domain: "{your_domain}"
```

#### OneLogin SSO

Which uses Custom OIDC for the ingestion

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: custom-oidc
    securityConfig:
      clientId: "{your_client_id}"
      secretKey: "{your_client_secret}"
      domain: "{your_domain}"
```

#### KeyCloak SSO

Which uses Custom OIDC for the ingestion

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: custom-oidc
    securityConfig:
      clientId: "{your_client_id}"
      secretKey: "{your_client_secret}"
      domain: "{your_domain}"
```
