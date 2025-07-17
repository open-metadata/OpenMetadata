---
title: Custom OIDC SSO for Docker | Official Documentation
description: Use custom OIDC providers within Docker environments to manage authentication securely across diverse application services and endpoints.
slug: /deployment/security/custom-oidc/docker
collate: false
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
AUTHENTICATION_PUBLIC_KEYS=[http://localhost:8080/realms/myrealm/protocol/openid-connect/certs, https://{your domain}/api/v1/system/config/jwks] # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
AUTHENTICATION_AUTHORITY={http://localhost:8080/realms/myrealm}
AUTHENTICATION_CLIENT_ID={Client ID} # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_oidc.env up -d
```

{% partial file="/v1.7/deployment/configure-ingestion.md" /%}

### Troubleshooting

* If you are seeing the below trace in the logs, you need to add the discovery URL

```
org.pac4j.core.exception.TechnicalException: You must define either the discovery URL or directly the provider metadata
```

To resolve the error regarding the discovery URL, you need to set the `AUTHENTICATION_DISCOVERY_URI` in your configuration. This URI is used to discover the OpenID Connect provider's configuration.

* If you are using a confidential type to start the server

When using a confidential type to start the server, it is necessary to provide all the details in the `docker-compose` file at the time of starting the server. For more information, refer to the [here](https://github.com/open-metadata/OpenMetadata/blob/main/conf/openmetadata.yaml#L179C3-L190C59).

Alternatively, the client type can be set to "public", which does not require a secret key.
