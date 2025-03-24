---
title: SAML SSO for Docker
slug: /deployment/security/saml/docker
collate: false
---

# SAML SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata_saml.env` file and add the following contents as an example. Use the information
generated when setting up the account.

The configuration below already uses the presets shown in the example of SAML configurations, you can change to yours.

{% note %}

If you are using an environment variable from an external file in our setup, and this environment variable is commented out in the `docker-compose` file, it will not be considered. To ensure it works, the commented section in the docker-compose file must be uncommented.

{% /note %}

```shell
# OpenMetadata Server IDP Configuration
SAML_IDP_ENTITY_ID=https://mocksaml.com/api/saml/sso
SAML_IDP_SSO_LOGIN_URL=https://saml.example.com/entityid
SAML_IDP_CERTIFICATE=/path/to/the/certificate
SAML_AUTHORITY_URL=http://localhost:8585/api/v1/saml/login
SAML_IDP_NAME_ID=urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress

# OpenMetadata Server SP Configuration
SAML_SP_ENTITY_ID=http://localhost:8585/api/v1/saml/acs
SAML_SP_ACS=http://localhost:8585/api/v1/saml/acs
SAML_SP_CERTIFICATE=/path/to/the/certificate
SAML_SP_CALLBACK=http://localhost:8585/saml/callback

# OpenMetadata Server Security Configuration
SAML_STRICT_MODE=false
SAML_SP_TOKEN_VALIDITY=3600
SAML_SEND_ENCRYPTED_NAME_ID=false
SAML_SEND_SIGNED_AUTH_REQUEST=false
SAML_SIGNED_SP_METADATA=false
SAML_WANT_MESSAGE_SIGNED=false
SAML_WANT_ASSERTION_SIGNED=false
SAML_WANT_ASSERTION_ENCRYPTED=false
SAML_WANT_NAME_ID_ENCRYPTED=false
SAML_KEYSTORE_FILE_PATH=/path/to/keystore.jks
SAML_KEYSTORE_ALIAS=myKeystoreAlias
SAML_KEYSTORE_PASSWORD=myKeystorePassword
```

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_saml.env up -d
```

{% partial file="/v1.7/deployment/configure-ingestion.md" /%}
