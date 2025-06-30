---
title: Amazon Cognito SSO for Docker
slug: /deployment/security/amazon-cognito/docker
collate: false
---

# Amazon Cognito SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata_cognito.env` file and add the following contents as an example. Use the information
generated when setting up the account in the previous steps.

```bash
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=aws-cognito
AUTHENTICATION_PUBLIC_KEYS=[{Cognito Domain}/{User Pool ID}/.well-known/jwks.json,  https://{your domain}/api/v1/system/config/jwks] # Update with your Cognito Domain and User Pool ID
AUTHENTICATION_AUTHORITY={Cognito Domain}/{User Pool ID} # Update with your Cognito Domain and User Pool ID as follows - https://cognito-idp.us-west-1.amazonaws.com/us-west-1_DL8xfTzj8
AUTHENTICATION_CLIENT_ID={Client ID} # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_cognito.env up -d
```

{% partial file="/v1.8/deployment/configure-ingestion.md" /%}
