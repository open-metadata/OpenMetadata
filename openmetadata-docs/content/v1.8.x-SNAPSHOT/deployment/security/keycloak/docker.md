---
title: Keycloak SSO for Docker
slug: /deployment/security/keycloak/docker
collate: false
---

# Keycloak SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata_keycloak.env` file and add the following contents as an example. Use the information
generated when setting up the account.



Check the more information about environment variable [here](/deployment/security/configuration-parameters).


{% codeWithLanguageSelector title="Auth Configuration" id="container-1" languagesArray=["implicit","authcode"] theme="dark" %}

```implicit
# Implicit Flow
AUTHORIZER_CLASS_NAME= org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER= org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]                 # john.doe from john.doe@example.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org       # Update with your Domain,The primary domain for the organization (example.com from john.doe@example.com).

AUTHENTICATION_PROVIDER=custom-oidc                 # Use "custom-oidc" for Keycloak
AUTHENTICATION_CLIENT_ID=testsso
CUSTOM_OIDC_AUTHENTICATION_PROVIDER_NAME=KeyCloak   # Name of the OIDC provider
AUTHENTICATION_PUBLIC_KEYS=[http://localhost:8081/auth/realms/data-sec/protocol/openid-connect/certs, https://{your domain}/api/v1/system/config/jwks]                                 # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
AUTHENTICATION_CALLBACK_URL="http://localhost:8585/callback"
AUTHENTICATION_AUTHORITY={http://localhost:8080/realms/{your-realm}}
AUTHENTICATION_CLIENT_TYPE=public
```

```authcode
# Auth Code Flow 
AUTHORIZER_CLASS_NAME= org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER= org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]                 # john.doe from john.doe@example.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org       # Update with your Domain,The primary domain for the organization (example.com from john.doe@example.com).

AUTHENTICATION_PROVIDER=custom-oidc                 # Use "custom-oidc" for Keycloak
CUSTOM_OIDC_AUTHENTICATION_PROVIDER_NAME=KeyCloak   # Name of the OIDC provider
AUTHENTICATION_PUBLIC_KEYS=[http://localhost:8081/auth/realms/data-sec/protocol/openid-connect/certs, https://{your domain}/api/v1/system/config/jwks]                                 # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
AUTHENTICATION_AUTHORITY={http://localhost:8081/auth/realms/data-sec}
AUTHENTICATION_CLIENT_ID=testsso
AUTHENTICATION_CALLBACK_URL="https://{your domain}/callback"
AUTHENTICATION_CLIENT_TYPE=confidential

OIDC_CLIENT_ID=testsso                             # Replace with your Keycloak client ID
OIDC_CLIENT_SECRET="{CLIENT_SECRET}"               # Replace with your Keycloak client secret
OIDC_TYPE="Keycloak"                               # Specify the OIDC provider (Keycloak)
OIDC_DISCOVERY_URI="OIDC_DISCOVERY_URI=http://host.docker.internal:8081/realms/openmetadata/.well-known/openid-configuration"                              # Keycloak's discovery URI Update your Keycloak's Domain and Realm
OIDC_CALLBACK="http://localhost:8585/callback"     # Callback URL registered in Keycloak
OIDC_SERVER_URL="http://localhost:8585"            # OpenMetadata server URL
```

{% /codeWithLanguageSelector %}

{% note %}

Altering the order of claims in `jwtPrincipalClaims` may lead to problems when matching a user from a token with an existing user in the system. The mapping process relies on the specific order of claims, so changing it can result in inconsistencies or authentication failures, as the system cannot ensure correct user mapping with a new claim order.

{% /note %}

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_keycloak.env up -d
```

{% partial file="/v1.8/deployment/configure-ingestion.md" /%}


{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="MdArrowBack"
    bold="KeyCloak"
    href="/deployment/security/keycloak" %}
    Go to KeyCloak Configuration
  {% /inlineCallout %}
{% /inlineCalloutContainer %}
