---
title: Azure SSO for Bare Metal
slug: /deployment/security/azure/bare-metal
---

# Azure SSO for Bare Metal

## Update conf/openmetadata.yaml

Once the `Client Id` and `Client Secret` are generated add the `Client Id` in `openmetadata.yaml` file in `client_id` field.

```yaml
authenticationConfiguration:
  provider: "azure"
  publicKeyUrls:
    - "https://login.microsoftonline.com/common/discovery/keys"
  authority: "https://login.microsoftonline.com/{Tenant ID}"
  clientId: "{Client ID}"
  callbackUrl: "http://localhost:8585/callback"
```

Then, 
- Update `authorizerConfiguration` to add login names of the admin users in `adminPrincipals` section as shown below.
- Update the `principalDomain` to your company domain name.

```yaml
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

Finally, update the Airflow information:

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
      clientId: ${OM_AUTH_AIRFLOW_AZURE_CLIENT_ID:-""}
```
