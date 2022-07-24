---
title: Azure SSO for Docker
slug: /deployment/security/azure/docker
---

# Azure SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata_azure.env` file and add the following contents as an example. Use the information
generated when setting up the account.

```yaml
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME: org.openmetadata.catalog.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER: org.openmetadata.catalog.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS: [ admin ]  # Your `name` from name@domain.com
AUTHORIZER_INGESTION_PRINCIPALS: [ ingestion-bot ]
AUTHORIZER_PRINCIPAL_DOMAIN: open-metadata.org

AUTHENTICATION_PROVIDER: azure
AUTHENTICATION_PUBLIC_KEYS:
  - "https://login.microsoftonline.com/common/discovery/keys"
AUTHENTICATION_AUTHORITY: "https://login.microsoftonline.com/{Tenant ID}"
AUTHENTICATION_CLIENT_ID: Client ID
AUTHENTICATION_CALLBACK_URL: http://localhost:8585/callback

# Airflow Configuration
AIRFLOW_AUTH_PROVIDER: azure
OM_AUTH_AIRFLOW_AZURE_CLIENT_SECRET: Client Secret
OM_AUTH_AIRFLOW_AZURE_AUTHORITY_URL: "https://login.microsoftonline.com/{Tenant ID}"
OM_AUTH_AIRFLOW_AZURE_SCOPES:
  - scope 1
  - scope 2
OM_AUTH_AIRFLOW_AZURE_CLIENT_ID: Client Id
```

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_azure.env up -d
```
