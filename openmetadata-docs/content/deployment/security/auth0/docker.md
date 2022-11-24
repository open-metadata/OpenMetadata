---
title: Auth0 SSO for Docker
slug: /deployment/security/auth0/docker
---

# Auth0 SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata_auth0.env` file and add the following contents as an example. Use the information
generated when setting up the account.

### 1.1 Before 0.12.1

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_INGESTION_PRINCIPALS=[ingestion-bot]
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=auth0
AUTHENTICATION_PUBLIC_KEYS=[{Domain}/.well-known/jwks.json] # Update with your Domain
AUTHENTICATION_AUTHORITY={Domain} # Update with your Domain
AUTHENTICATION_CLIENT_ID={Client ID} # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback

# Airflow Configuration
AIRFLOW_AUTH_PROVIDER=auth0
OM_AUTH_AIRFLOW_AUTH0_CLIENT_ID={Client ID} # Update with your Client ID
OM_AUTH_AIRFLOW_AUTH0_CLIENT_SECRET={Client Secret} # Update with your Client Secret
OM_AUTH_AIRFLOW_AUTH0_DOMAIN_URL={Domain} # Update with your Domain
```

### 1.2 After 0.12.1

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_INGESTION_PRINCIPALS=[ingestion-bot]
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=auth0
AUTHENTICATION_PUBLIC_KEYS=[{Domain}/.well-known/jwks.json] # Update with your Domain
AUTHENTICATION_AUTHORITY={Domain} # Update with your Domain
AUTHENTICATION_CLIENT_ID={Client ID} # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

### 1.3 After 0.13.0

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=auth0
AUTHENTICATION_PUBLIC_KEYS=[{Domain}/.well-known/jwks.json] # Update with your Domain
AUTHENTICATION_AUTHORITY={Domain} # Update with your Domain
AUTHENTICATION_CLIENT_ID={Client ID} # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

**Note:** Follow [this](/how-to-guides/feature-configurations/bots) guide to configure the `ingestion-bot` credentials for
ingesting data from Airflow.

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_auth0.env up -d
```
