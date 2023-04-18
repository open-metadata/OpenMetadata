---
title: Azure SSO for Docker
slug: /deployment/security/azure/docker
---

# Azure SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Get the `Client Id` and `Tenant ID` from Azure Application configured in [Step 3](/deployment/security/azure#step-3-where-to-find-the-credentials).

Get the Azure Service Application `Client Id`, `Client Secret`, `Authority`, `Scopes` from the information collected in [Step 9](/deployment/security/azure#step-9-note-down-the-clientid-and-authority).

Create an `openmetadata_azure.env` file and add the following contents as an example. Use the information
generated when setting up the account.

### 1.1 Before 0.12.1

<Note>

The Object Id will be `<object-id-for-azure-service-application-enterprise-application>` fetched from [Step 9](/deployment/security/azure#step-9-note-down-the-clientid-and-authority). 

</Note>

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.catalog.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.catalog.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_INGESTION_PRINCIPALS=[ingestion-bot, {object-id-for-azure-service-application-enterprise-application}]
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=azure
AUTHENTICATION_PUBLIC_KEYS=[https://login.microsoftonline.com/common/discovery/keys]
AUTHENTICATION_AUTHORITY=https://login.microsoftonline.com/{Tenant ID} # Update with your Tenant ID
AUTHENTICATION_CLIENT_ID={Client ID} # Update with your Client ID of Azure Application
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback

# Airflow Configuration
AIRFLOW_AUTH_PROVIDER=azure
OM_AUTH_AIRFLOW_AZURE_CLIENT_SECRET={Client Secret} # Update with your Client Secret
OM_AUTH_AIRFLOW_AZURE_AUTHORITY_URL=https://login.microsoftonline.com/{Tenant ID} # Update with your Tenant ID
OM_AUTH_AIRFLOW_AZURE_SCOPES=[{scopes}] # Update with your Scopes
OM_AUTH_AIRFLOW_AZURE_CLIENT_ID={Client Id} # Update with your Client ID of Azure Service Application
```

### 1.2 After 0.12.1

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_INGESTION_PRINCIPALS=[ingestion-bot]
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=azure
AUTHENTICATION_PUBLIC_KEYS=[https://login.microsoftonline.com/common/discovery/keys]
AUTHENTICATION_AUTHORITY=https://login.microsoftonline.com/{Tenant ID} # Update with your Tenant ID
AUTHENTICATION_CLIENT_ID={Client ID} # Update with your Client ID of Azure Application
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

### 1.3 After 0.13.0

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=azure
AUTHENTICATION_PUBLIC_KEYS=[https://login.microsoftonline.com/common/discovery/keys]
AUTHENTICATION_AUTHORITY=https://login.microsoftonline.com/{Tenant ID} # Update with your Tenant ID
AUTHENTICATION_CLIENT_ID={Client ID} # Update with your Client ID of Azure Application
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback

<Note>

Follow [this](/deployment/security/azure#step-10-update-ingestion-bot-with-azure-sso-service-application) guide to configure the `ingestion-bot` credentials for ingesting data from Airflow.

</Note>

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_azure.env up -d
```
