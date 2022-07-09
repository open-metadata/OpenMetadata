---
title: Auth0 SSO for Docker
slug: /deployment/security/auth0/docker
---

# Auth0 SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata_auth0.env` file and add the following contents as an example. Use the information
generated when setting up the account.

```yaml
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME: org.openmetadata.catalog.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER: org.openmetadata.catalog.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS: [ admin ]  # Your `name` from name@domain.com
AUTHORIZER_INGESTION_PRINCIPALS: [ ingestion-bot ]
AUTHORIZER_PRINCIPAL_DOMAIN: open-metadata.org

AUTHENTICATION_PROVIDER: auth0
AUTHENTICATION_PUBLIC_KEYS:
  - "https://parth-panchal.us.auth0.com/.well-known/jwks.json"
AUTHENTICATION_AUTHORITY: "https://parth-panchal.us.auth0.com/"
AUTHENTICATION_CLIENT_ID: Client ID
AUTHENTICATION_CALLBACK_URL: http://localhost:8585/callback

# Airflow Configuration
AIRFLOW_AUTH_PROVIDER: auth0
OM_AUTH_AIRFLOW_AUTH0_CLIENT_ID: Client ID
OM_AUTH_AIRFLOW_AUTH0_CLIENT_SECRET: Client Secret
OM_AUTH_AIRFLOW_AUTH0_DOMAIN_URL: Domain
```

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_auth0.env up -d
```
