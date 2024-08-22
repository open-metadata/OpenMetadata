---
title: Azure SSO for Docker
slug: /deployment/security/azure/docker
---

# Azure SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Get the `Client Id` and `Tenant ID` from Azure Application configured in [Step 3](/deployment/security/azure#step-3-where-to-find-the-credentials).

Create an `openmetadata_azure.env` file and add the following contents as an example. Use the information
generated when setting up the account.

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=azure
AUTHENTICATION_PUBLIC_KEYS=[https://login.microsoftonline.com/common/discovery/keys, {your domain}/api/v1/system/config/jwks] # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
AUTHENTICATION_AUTHORITY=https://login.microsoftonline.com/{Tenant ID} # Update with your Tenant ID
AUTHENTICATION_CLIENT_ID={Client ID} # Update with your Client ID of Azure Application
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

{% note %}

Altering the order of claims in `jwtPrincipalClaims` may lead to problems when matching a user from a token with an existing user in the system. The mapping process relies on the specific order of claims, so changing it can result in inconsistencies or authentication failures, as the system cannot ensure correct user mapping with a new claim order.

{% /note %}

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_azure.env up -d
```

{% partial file="/v1.5/deployment/configure-ingestion.md" /%}
