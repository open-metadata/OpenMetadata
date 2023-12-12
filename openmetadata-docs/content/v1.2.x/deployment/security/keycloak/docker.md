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

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin-user]  # Your `name` from name@domain.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=custom-oidc
CUSTOM_OIDC_AUTHENTICATION_PROVIDER_NAME=KeyCloak
AUTHENTICATION_PUBLIC_KEYS=[http://localhost:8081/auth/realms/data-sec/protocol/openid-connect/certs, http://{your openmetadata domain}/api/v1/config/jwks] # Update with your Domain and Make sure this "/api/v1/config/jwks" is always configured to enable JWT tokens
AUTHENTICATION_AUTHORITY={http://localhost:8081/auth/realms/data-sec}
AUTHENTICATION_CLIENT_ID=open-metadata # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_keycloak.env up -d
```

{% partial file="/v1.2/deployment/configure-ingestion.md" /%}
