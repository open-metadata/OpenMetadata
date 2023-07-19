---
title: Okta SSO for Docker
slug: /deployment/security/okta/docker
---

# Okta SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata_okta.env` file and add the following contents as an example. Use the information
generated when setting up the account.

Note: Make sure to add the Ingestion Client ID for the Service application in `AUTHORIZER_INGESTION_PRINCIPALS`. This can be found in Okta -> Applications -> Applications, Refer to Step 3 for `Creating Service Application`.

### 1.1 Before 0.12.1

OM_AUTH_AIRFLOW_OKTA_PRIVATE_KEY to be set as per the example below using the escape sequence for quotes.

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_INGESTION_PRINCIPALS=[ingestion-bot, <service_application_client_id>]
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=okta
AUTHENTICATION_PUBLIC_KEYS={ISSUER_URL}/v1/keys # Update with your Issuer URL
AUTHENTICATION_AUTHORITY={ISSUER_URL} # Update with your Issuer URL
AUTHENTICATION_CLIENT_ID={CLIENT_ID - SPA APP} # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback

# Airflow Configuration
AIRFLOW_AUTH_PROVIDER=okta
OM_AUTH_AIRFLOW_OKTA_CLIENT_ID={OM_AUTH_AIRFLOW_OKTA_CLIENT_ID:-""}
OM_AUTH_AIRFLOW_OKTA_ORGANIZATION_URL={OM_AUTH_AIRFLOW_OKTA_ORGANIZATION_URL:-""}
OM_AUTH_AIRFLOW_OKTA_PRIVATE_KEY=\'{"p":"lorem","kty":"RSA","q":"ipsum","d":"dolor","e":"AQAB","use":"sig","kid":"0oa5p908cltOc4fsl5d7","qi":"lorem","dp":"lorem","alg":"RS256","dq":"ipsum","n":"dolor"}\'
OM_AUTH_AIRFLOW_OKTA_SA_EMAIL={OM_AUTH_AIRFLOW_OKTA_SA_EMAIL:-""}
OM_AUTH_AIRFLOW_OKTA_SCOPES={OM_AUTH_AIRFLOW_OKTA_SCOPES:-[]}
```

### 1.2 After 0.12.1

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_INGESTION_PRINCIPALS=[ingestion-bot, <service_application_client_id>]
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=okta
AUTHENTICATION_PUBLIC_KEYS={ISSUER_URL}/v1/keys # Update with your Issuer URL
AUTHENTICATION_AUTHORITY={ISSUER_URL} # Update with your Issuer URL
AUTHENTICATION_CLIENT_ID={CLIENT_ID - SPA APP} # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

### 1.3 After 0.13.0

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=okta
AUTHENTICATION_PUBLIC_KEYS={ISSUER_URL}/v1/keys # Update with your Issuer URL
AUTHENTICATION_AUTHORITY={ISSUER_URL} # Update with your Issuer URL
AUTHENTICATION_CLIENT_ID={CLIENT_ID - SPA APP} # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

**Note:** Follow [this](/how-to-guides/feature-configurations/bots) guide to configure the `ingestion-bot` credentials for
ingesting data from Airflow.

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_okta.env up -d
```
