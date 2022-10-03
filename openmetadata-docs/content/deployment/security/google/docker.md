---
title: Google SSO for Docker
slug: /deployment/security/google/docker
---

# Google SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## Before 0.12.1

### 1. Create an .env file

Create an `openmetadata_google.env` file and add the following contents as an example. Use the information
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

### 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_google.env up -d
```

## After 0.12.1

### 1. Create an .env file

Create an `openmetadata_google.env` file and add the following contents as an example. Use the information
generated when setting up the account in the previous steps.

```bash
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_INGESTION_PRINCIPALS=[ingestion-bot]
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=google
AUTHENTICATION_PUBLIC_KEYS=[https://www.googleapis.com/oauth2/v3/certs]
AUTHENTICATION_AUTHORITY=https://accounts.google.com
AUTHENTICATION_CLIENT_ID={Client ID} # Update with your Google SSO Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

### 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_google.env up -d
```

### 3. Set up the `ingestion-bot`

Set up the `ingestion-bot` from UI. Go to `Settings` > `Bots`.

- Click on `ingestion-bot`

<Image src="/images/deployment/security/google/click-bot.png" alt="click-bot" caption="Click on 'ingestion-bot'"/>

- Select `Google SSO` from the list.

<Image src="/images/deployment/security/google/select-google-sso.png" alt="select-google-sso" caption="Select 'Google SSO'"/>

- Configure it with your SSO values. Ensure that the account email of your SSO matches the one of the bot.

<Image src="/images/deployment/security/google/configure-bot.png" alt="configure-bot" caption="Configure the ingestion-bot with your SSO values"/>

**Note**:

1. **JWT Token auth mechanism**

If you decide to configure a JWT Token for the authentication mechanism ensure that you have also the value `http://localhost:8585/api/v1/config/jwks`
in your `AUTHENTICATION_PUBLIC_KEYS` list:

```bash
AUTHENTICATION_PUBLIC_KEYS=[https://www.googleapis.com/oauth2/v3/certs, http://localhost:8585/api/v1/config/jwks]
```

2. **Redeploying ingestion pipelines**

When the `ingestion-bot` is updated, we must redeploy our ingestion pipelines since the credentials used by the bot have been updated,
and they will no longer be valid.
