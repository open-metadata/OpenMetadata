---
title: Azure SSO for Bare Metal
slug: /deployment/security/azure/bare-metal
---

# Azure SSO for Bare Metal

Get the `Client Id` and `Tenant ID` from Azure Application configured in [Step 3](/deployment/security/azure#step-3-where-to-find-the-credentials).

Get the Azure Service Application `Client Id`, `Client Secret`, `Authority`, `Scopes` from the information collected in [Step 9](/deployment/security/azure#step-9-note-down-the-clientid-and-authority).

## Update conf/openmetadata.yaml

```yaml
authenticationConfiguration:
  provider: "azure"
  publicKeyUrls:
    - "https://login.microsoftonline.com/common/discovery/keys"
  authority: "https://login.microsoftonline.com/{Tenant ID}"
  clientId: "{Client ID}" # Azure Application
  callbackUrl: "http://localhost:8585/callback"
```

Then, 
- Update `authorizerConfiguration` to add login names of the admin users in `adminPrincipals` section as shown below.
- Update the `principalDomain` to your company domain name.

```yaml
authorizerConfiguration:
  className: "org.openmetadata.service.security.DefaultAuthorizer"
  # JWT Filter
  containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
  adminPrincipals:
    - "user1"
    - "user2"
  principalDomain: "open-metadata.org"
```

In `0.12.1` the `className` and `containerRequestFilter` must replace `org.openmetadata.catalog` by `org.openmetadata.service`.

Finally, update the Airflow information:

**Before 0.12.1**

Once the `Client Id` and `Client Secret` are generated for Azure SSO Service Application, add in `openmetadata.yaml` file for the information collected in [Step 9](/deployment/security/azure#step-9-note-down-the-clientid-and-authority).

```yaml
airflowConfiguration:
  apiEndpoint: ${AIRFLOW_HOST:-http://localhost:8080}
  username: ${AIRFLOW_USERNAME:-admin}
  password: ${AIRFLOW_PASSWORD:-admin}
  metadataApiEndpoint: ${SERVER_HOST_API_URL:-http://localhost:8585/api}
  authProvider: azure
  authConfig:
    azure:
      clientSecret: ${OM_AUTH_AIRFLOW_AZURE_CLIENT_SECRET:-""}
      authority: ${OM_AUTH_AIRFLOW_AZURE_AUTHORITY_URL:-""}
      scopes: ${OM_AUTH_AIRFLOW_AZURE_SCOPES:-[]}
      clientId: ${OM_AUTH_AIRFLOW_AZURE_CLIENT_ID:-""} # Azure Service Application
```

**After 0.12.1**

```yaml
airflowConfiguration:
  apiEndpoint: ${AIRFLOW_HOST:-http://localhost:8080}
  username: ${AIRFLOW_USERNAME:-admin}
  password: ${AIRFLOW_PASSWORD:-admin}
  metadataApiEndpoint: ${SERVER_HOST_API_URL:-http://localhost:8585/api}
```

<Note>

Follow [this](/deployment/security/azure#step-10-update-ingestion-bot-with-azure-sso-service-application) guide to configure the `ingestion-bot` credentials for ingesting data from Airflow.

</Note>