---
title: Okta SSO for Docker
slug: /deployment/security/okta/docker
collate: false
---

# Okta SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata_okta.env` file and add the following contents as an example. Use the information
generated when setting up the account.

Note: Make sure to add the Ingestion Client ID for the Service application in `AUTHORIZER_INGESTION_PRINCIPALS`. This can be found in Okta -> Applications -> Applications, Refer to Step 3 for `Creating Service Application`.


```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=okta
AUTHENTICATION_PUBLIC_KEYS=[{ISSUER_URL}/v1/keys, https://{your domain}/api/v1/system/config/jwks]  # Update with your Issuer URL
AUTHENTICATION_AUTHORITY={ISSUER_URL} # Update with your Issuer URL
AUTHENTICATION_CLIENT_ID={CLIENT_ID - SPA APP} # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=https://{your domain}/callback
```

{% note %}

`AUTHENTICATION_PUBLIC_KEYS` and `AUTHENTICATION_CALLBACK_URL` refers to https://{your domain} this is referring to your OpenMetdata installation domain name
and please make sure to correctly put http or https depending on your installation.

{% /note %}

**Note:** Follow [this](/developers/bots) guide to configure the `ingestion-bot` credentials for
ingesting data from Airflow.

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_okta.env up -d
```
