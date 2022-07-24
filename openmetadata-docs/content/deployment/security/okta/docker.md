---
title: Okta SSO for Docker
slug: /deployment/security/okta/docker
---

# Okta SSO for Docker

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

AUTHENTICATION_PROVIDER: okta
AUTHENTICATION_PUBLIC_KEYS:
  - "{ISSUER_URL}/v1/keys"
AUTHENTICATION_AUTHORITY: "{ISSUER_URL}"
AUTHENTICATION_CLIENT_ID: "{CLIENT_ID - SPA APP}"
AUTHENTICATION_CALLBACK_URL: http://localhost:8585/callback

# Airflow Configuration
AIRFLOW_AUTH_PROVIDER: okta
OM_AUTH_AIRFLOW_OKTA_CLIENT_ID: ${OM_AUTH_AIRFLOW_OKTA_CLIENT_ID:-""}
OM_AUTH_AIRFLOW_OKTA_ORGANIZATION_URL: ${OM_AUTH_AIRFLOW_OKTA_ORGANIZATION_URL:-""}
OM_AUTH_AIRFLOW_OKTA_PRIVATE_KEY: ${OM_AUTH_AIRFLOW_OKTA_PRIVATE_KEY:-""}
OM_AUTH_AIRFLOW_OKTA_SA_EMAIL: ${OM_AUTH_AIRFLOW_OKTA_SA_EMAIL:-""}
OM_AUTH_AIRFLOW_OKTA_SCOPES: ${OM_AUTH_AIRFLOW_OKTA_SCOPES:-[]}
```

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_azure.env up -d
```
