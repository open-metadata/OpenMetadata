---
title: One Login SSO for Docker | Official Documentation
description: Deploy OneLogin authentication in Docker for fast, secure user validation and centralized identity management in container services.
slug: /deployment/security/one-login/docker
collate: false
---

# One Login SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata_onelogin.env` file and add the following contents as an example. Use the information
generated when setting up the account.

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=custom-oidc
AUTHENTICATION_PUBLIC_KEYS=[{public key url}, https://{your domain}/api/v1/system/config/jwks] # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
AUTHENTICATION_AUTHORITY={issuer url} # Update with your Issuer URL
AUTHENTICATION_CLIENT_ID={Client ID} # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_onelogin.env up -d
```

{% partial file="/v1.9/deployment/configure-ingestion.md" /%}
