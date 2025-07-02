---
title: Azure SSO for Docker | OpenMetadata Deployment Guide
slug: /deployment/security/azure/docker
collate: false
---

# Azure SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata_azure.env` file and use the following example as a reference. Replace the placeholder values with the details generated during your Azure account and application credentials setup.

Check the more information about environment variable [here](/deployment/security/configuration-parameters).

{% codeWithLanguageSelector title="Auth Configuration" id="container-1" languagesArray=["implicit","authcode"] theme="dark" %}

```implicit
# Implicit Flow
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]                 # john.doe from john.doe@example.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org       # Update with your Domain,The primary domain for the organization (example.com from john.doe@example.com).
AUTHENTICATION_PROVIDER=azure
AUTHENTICATION_PUBLIC_KEYS=[https://login.microsoftonline.com/common/discovery/keys, https://{your domain}/api/v1/system/config/jwks]   # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
AUTHENTICATION_AUTHORITY=https://login.microsoftonline.com/{Tenant ID}                                                          # Update with your Tenant ID
AUTHENTICATION_CLIENT_ID={CLIENT_ID}            # Update with your Client ID of Azure Application
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
AUTHENTICATION_CLIENT_TYPE= public
```

```authcode
# Auth Code Flow 
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]                 # john.doe from john.doe@example.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org       # Update with your Domain,The primary domain for the organization (example.com from john.doe@example.com).
AUTHENTICATION_PROVIDER=azure
AUTHENTICATION_PUBLIC_KEYS=[https://login.microsoftonline.com/common/discovery/keys, https://{your domain}/api/v1/system/config/jwks]   # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
AUTHENTICATION_AUTHORITY=https://login.microsoftonline.com/{Tenant ID}                                                          # Update with your Tenant ID
AUTHENTICATION_CLIENT_ID={CLIENT_ID}            # Update with your Client ID of Azure Application
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
AUTHENTICATION_CLIENT_TYPE=confidential

OIDC_CLIENT_ID={Client ID}                      # Update with your Client ID
OIDC_TYPE= azure
OIDC_TENANT=https://login.microsoftonline.com/{Tenant ID} 
OIDC_CLIENT_SECRET={Client Secret}              # Update with your Client Secret
OIDC_DISCOVERY_URI= https://login.microsoftonline.com/.well-known/openid-configuration  
OIDC_DISCOVERY_URI= ""      
OIDC_CALLBACK= ${OIDC_CALLBACK:-"http://localhost:8585/callback"}

```

{% /codeWithLanguageSelector %}

{% note %}

Altering the order of claims in `jwtPrincipalClaims` may lead to problems when matching a user from a token with an existing user in the system. The mapping process relies on the specific order of claims, so changing it can result in inconsistencies or authentication failures, as the system cannot ensure correct user mapping with a new claim order.

{% /note %}

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_azure.env up -d
```

{% partial file="/v1.8/deployment/configure-ingestion.md" /%}


{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="MdArrowBack"
    bold="Azure"
    href="/deployment/security/azure" %}
    Go to Azure Configuration
  {% /inlineCallout %}
{% /inlineCalloutContainer %}
