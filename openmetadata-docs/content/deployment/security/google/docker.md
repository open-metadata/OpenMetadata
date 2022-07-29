---
title: Google SSO for Docker
slug: /deployment/security/google/docker
---

# Google SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata.env` file and add the following contents as an example. Use the information
generated when setting up the account in the previous steps.

```bash
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.catalog.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.catalog.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_INGESTION_PRINCIPALS=[ingestion-bot]
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=google
AUTHENTICATION_PUBLIC_KEYS=[https://www.googleapis.com/oauth2/v3/certs]
AUTHENTICATION_AUTHORITY=https://accounts.google.com
AUTHENTICATION_CLIENT_ID={Client ID} # Update with your Google SSO Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback

# Airflow Configuration
AIRFLOW_AUTH_PROVIDER=google
OM_AUTH_AIRFLOW_GOOGLE_SECRET_KEY_PATH=/path/to/secret.json
```

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata.env up -d
```
