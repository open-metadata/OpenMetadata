---
title: Google SSO for Docker
slug: /deployment/security/google/docker
collate: false
---

# Google SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

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
AUTHENTICATION_PUBLIC_KEYS=[https://www.googleapis.com/oauth2/v3/certs, https://{your domain}/api/v1/system/config/jwks] # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
AUTHENTICATION_AUTHORITY=https://accounts.google.com
AUTHENTICATION_CLIENT_ID={Client ID} # Update with your Google SSO Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

### 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_google.env up -d
```

{% partial file="/v1.9/deployment/configure-ingestion.md" /%}
