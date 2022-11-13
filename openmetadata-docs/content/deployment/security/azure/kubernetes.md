---
title: Azure SSO for Kubernetes
slug: /deployment/security/azure/kubernetes
---

# Azure SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Get the `Client Id` and `Tenant ID` from Azure Application configured in [Step 3](/deployment/security/azure#step-3-where-to-find-the-credentials).

Get the Azure Service Application `Client Id`, `Client Secret`, `Authority`, `Scopes` from the information collected in [Step 9](/deployment/security/azure#step-9-note-down-the-clientid-and-authority).

See the snippet below for an example of where to place the values and update the authorizer configurations in the `values.yaml`.


### Before 0.12.1

<Note>

The Object Id will be `<object-id-for-azure-service-application-enterprise-application>` fetched from [Step 9](/deployment/security/azure#step-9-note-down-the-clientid-and-authority). 

</Note>

```yaml
global:
  authorizer:
    className: "org.openmetadata.catalog.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
    initialAdmins:
      - "user1"
      - "user2"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "azure"
    publicKeys:
      - "https://login.microsoftonline.com/common/discovery/keys"
    authority: "https://login.microsoftonline.com/{Tenant ID}"
    clientId: "{Client ID}" # Azure Application
    callbackUrl: "http://localhost:8585/callback"
  airflow:
    openmetadata:
      authProvider: "azure"
      azure:
        clientSecret:
          secretRef: azure-client-secret
          secretKey: azure-client-secret
        authority: "https://login.microsoftonline.com/{Tenant ID}"
        scopes: [ ]
        clientId: "{Client ID}" # Azure Service Application
```

### After 0.12.1

```yaml
global:
  authorizer:
    className: "org.openmetadata.service.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
    initialAdmins:
      - "user1"
      - "user2"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "azure"
    publicKeys:
      - "https://login.microsoftonline.com/common/discovery/keys"
    authority: "https://login.microsoftonline.com/{Tenant ID}"
    clientId: "{Client ID}" # Azure Application
    callbackUrl: "http://localhost:8585/callback"
```

<Note>

Follow [this](/deployment/security/azure#step-10-update-ingestion-bot-with-azure-sso-service-application) guide to configure the `ingestion-bot` credentials for ingesting data from Airflow.

</Note>