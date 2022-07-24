---
title: Custom OIDC SSO for Docker
slug: /deployment/security/custom-oidc/docker
---

# Custom OIDC SSO for Docker

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

AUTHENTICATION_PROVIDER: custom-oidc
CUSTOM_OIDC_AUTHENTICATION_PROVIDER_NAME: KeyCloak
AUTHENTICATION_PUBLIC_KEYS:
  - "http://localhost:8080/realms/myrealm/protocol/openid-connect/certs"
AUTHENTICATION_AUTHORITY: "http://localhost:8080/realms/myrealm"
AUTHENTICATION_CLIENT_ID: Client ID
AUTHENTICATION_CALLBACK_URL: http://localhost:8585/callback

# Airflow Configuration
AIRFLOW_AUTH_PROVIDER: custom-oidc
OM_AUTH_AIRFLOW_CUSTOM_OIDC_CLIENT_ID: Client Id
# Make sure to add the path where the file is saved in the Airflow Volume
# It needs to be reachable locally by the container
OM_AUTH_AIRFLOW_CUSTOM_OIDC_SECRET_KEY_PATH: Secret Key Path
OM_AUTH_AIRFLOW_CUSTOM_OIDC_TOKEN_ENDPOINT_URL: endpoint
```

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_azure.env up -d
```
