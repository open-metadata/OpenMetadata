---
title: Keycloak SSO for Docker
slug: /deployment/security/keycloak/docker
---

# Keycloak SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata_keycloak.env` file and add the following contents as an example. Use the information
generated when setting up the account.

The configuration below already uses the presets shown in the example of keycloak configurations, you can change to yours.

### 1.1 Before 0.12.1

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin-user]  # Your `name` from name@domain.com
AUTHORIZER_INGESTION_PRINCIPALS=[ingestion-bot,service-account-open-metadata]
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=custom-oidc
CUSTOM_OIDC_AUTHENTICATION_PROVIDER_NAME=KeyCloak
AUTHENTICATION_PUBLIC_KEYS=[http://localhost:8081/auth/realms/data-sec/protocol/openid-connect/certs]
AUTHENTICATION_AUTHORITY=http://localhost:8081/auth/realms/data-sec
AUTHENTICATION_CLIENT_ID=open-metadata # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback

# Airflow Configuration
AIRFLOW_AUTH_PROVIDER=custom-oidc
OM_AUTH_AIRFLOW_CUSTOM_OIDC_CLIENT_ID=open-metadata # Update with your Client ID
OM_AUTH_AIRFLOW_CUSTOM_OIDC_SECRET_KEY={Secret Key} # Update with your Secret Key
OM_AUTH_AIRFLOW_CUSTOM_OIDC_TOKEN_ENDPOINT_URL="http://localhost:8081/realms/data-sec/protocol/openid-connect/token"
```

### 1.2 After 0.12.1

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin-user]  # Your `name` from name@domain.com
AUTHORIZER_INGESTION_PRINCIPALS=[ingestion-bot,service-account-open-metadata]
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=custom-oidc
CUSTOM_OIDC_AUTHENTICATION_PROVIDER_NAME=KeyCloak
AUTHENTICATION_PUBLIC_KEYS=[{http://localhost:8081/auth/realms/data-sec/protocol/openid-connect/certs}]
AUTHENTICATION_AUTHORITY={http://localhost:8081/auth/realms/data-sec}
AUTHENTICATION_CLIENT_ID=open-metadata # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

### 1.3 After 0.13.0

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin-user]  # Your `name` from name@domain.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=custom-oidc
CUSTOM_OIDC_AUTHENTICATION_PROVIDER_NAME=KeyCloak
AUTHENTICATION_PUBLIC_KEYS=[{http://localhost:8081/auth/realms/data-sec/protocol/openid-connect/certs}]
AUTHENTICATION_AUTHORITY={http://localhost:8081/auth/realms/data-sec}
AUTHENTICATION_CLIENT_ID=open-metadata # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

**Note:** Follow [this](/how-to-guides/feature-configurations/bots) guide to configure the `ingestion-bot` credentials for
ingesting data from Airflow.

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_keycloak.env up -d
```
