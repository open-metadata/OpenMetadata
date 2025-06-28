---
title: Azure SSO | OpenMetadata Security Integration
slug: /deployment/security/auth0/docker
collate: false
---

# Auth0 SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata_auth0.env` file and use the following example as a reference. Replace the placeholder values with the details generated during your Auth0 account and application credentials setup.

Check the more information about environment variable [here](/deployment/security/configuration-parameters).


{% codeWithLanguageSelector title="Auth Configuration" id="container-1" languagesArray=["implicit","authcode"] theme="dark" %}
```implicit
# Implicit Flow
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]                 # john.doe from john.doe@example.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org       # Update with your Domain,The primary domain for the organization (example.com from john.doe@example.com).
AUTHENTICATION_PROVIDER=auth0
AUTHENTICATION_PUBLIC_KEYS=[{Domain}/.well-known/jwks.json, https://{your domain}/api/v1/system/config/jwks]     # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
AUTHENTICATION_AUTHORITY={Domain}                   # The base URL of the authentication provider.
AUTHENTICATION_CLIENT_ID={Client ID}                # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
AUTHENTICATION_CLIENT_TYPE= public
```

```authcode
# Auth Code Flow 
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]                 # john.doe from john.doe@example.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org       # Update with your Domain,The primary domain for the organization (example.com from john.doe@example.com).
AUTHENTICATION_PROVIDER=auth0
AUTHENTICATION_PUBLIC_KEYS=[{Domain}/.well-known/jwks.json, https://{your domain}/api/v1/system/config/jwks]         # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
AUTHENTICATION_AUTHORITY={Domain}                   # The base URL of the authentication provider.
AUTHENTICATION_CLIENT_ID={Client ID}                # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback 
AUTHENTICATION_CLIENT_TYPE= confidential

OIDC_CLIENT_ID={Client ID}                          # Update with your Client ID
OIDC_TYPE=auth0 
OIDC_CLIENT_SECRET={Client Secret}                  # Update with your Client Secret
OIDC_DISCOVERY_URI: http://{Domain}/.well-known/openid-configuration        # Update with your Domain
OIDC_CALLBACK: ${OIDC_CALLBACK:-"http://localhost:8585/callback"}


```

{% /codeWithLanguageSelector %}



## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_auth0.env up -d
```

{% partial file="/v1.9/deployment/configure-ingestion.md" /%}


{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="MdArrowBack"
    bold="Auth"
    href="/deployment/security/auth0" %}
    Go to Auth0 Configuration
  {% /inlineCallout %}
{% /inlineCalloutContainer %}
