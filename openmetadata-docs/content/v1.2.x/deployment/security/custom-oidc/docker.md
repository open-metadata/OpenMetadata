---
title: Custom OIDC SSO for Docker
slug: /deployment/security/custom-oidc/docker
---

# Custom OIDC SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata_oidc.env` file and add the following contents as an example. Use the information
generated when setting up the account.

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=custom-oidc
CUSTOM_OIDC_AUTHENTICATION_PROVIDER_NAME=KeyCloak
AUTHENTICATION_PUBLIC_KEYS=[{http://localhost:8080/realms/myrealm/protocol/openid-connect/certs}]
AUTHENTICATION_AUTHORITY={http://localhost:8080/realms/myrealm}
AUTHENTICATION_CLIENT_ID={Client ID} # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_oidc.env up -d
```

{% partial file="/v1.2/deployment/configure-ingestion.md" /%}
