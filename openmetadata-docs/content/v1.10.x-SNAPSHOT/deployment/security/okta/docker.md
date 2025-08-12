---
title: Okta SSO for Docker | OpenMetadata Deployment Guide
description: Set up Okta authentication in Docker to streamline secure identity workflows, token validation, and backend integration for containers.
slug: /deployment/security/okta/docker
collate: false
---

# Okta SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata_okta.env` file and use the following example as a reference. Replace the placeholder values with the details generated during your Okta account and application credentials setup.

Check the more information about environment variable [here](/deployment/security/configuration-parameters).


{% codeWithLanguageSelector title="Auth Configuration" id="container-1" languagesArray=["implicit","authcode"] theme="dark" %}

```implicit
# Implicit Flow
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]                 # john.doe from john.doe@example.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org       # Update with your Domain,The primary domain for the organization (example.com from john.doe@example.com).
AUTHENTICATION_PROVIDER=okta
AUTHENTICATION_PUBLIC_KEYS=[{ISSUER_URL}/v1/keys, https://{your domain}/api/v1/system/config/jwks] # Update with your Issuer URL
AUTHENTICATION_AUTHORITY={ISSUER_URL}           # Update with your Issuer URL
AUTHENTICATION_CLIENT_ID={CLIENT_ID}            # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
AUTHENTICATION_CLIENT_TYPE= public
```

```authcode
# Auth Code Flow 
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]                 # john.doe from john.doe@example.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org       # Update with your Domain,The primary domain for the organization (example.com from john.doe@example.com).
AUTHENTICATION_PROVIDER=okta
AUTHENTICATION_PUBLIC_KEYS=[{ISSUER_URL}/v1/keys, https://{your domain}/api/v1/system/config/jwks]   # Update with your Issuer URL and  Domain also Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
AUTHENTICATION_AUTHORITY={ISSUER_URL}           # Update with your Issuer URL
AUTHENTICATION_CLIENT_ID={Client ID}            # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback 
AUTHENTICATION_CLIENT_TYPE=confidential

OIDC_CLIENT_ID={Client ID}                      # Update with your Client ID
OIDC_TYPE=okta
OIDC_CLIENT_SECRET={Client Secret}              # Update with your Client Secret
OIDC_DISCOVERY_URI: http://{ISSUER_URL}/.well-known/openid-configuration        # Update with your Issuer URL
OIDC_CALLBACK: ${OIDC_CALLBACK:-"http://localhost:8585/callback"}

```

{% /codeWithLanguageSelector %}


## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_okta.env up -d
```

{% partial file="/v1.10/deployment/configure-ingestion.md" /%}

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="MdArrowBack"
    bold="OKTA"
    href="/deployment/security/okta" %}
    Go to okta Configuration
  {% /inlineCallout %}
{% /inlineCalloutContainer %}