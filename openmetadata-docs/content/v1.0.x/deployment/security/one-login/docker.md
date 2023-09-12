---
title: One Login SSO for Docker
slug: /deployment/security/one-login/docker
---

# One Login SSO for Docker

To enable security for the Docker deployment, follow the next steps:

## 1. Create an .env file

Create an `openmetadata_onelogin.env` file and add the following contents as an example. Use the information
generated when setting up the account.

- Update `AUTHORIZER_ADMIN_PRINCIPALS` to add login names of the admin users in  section as shown below. Make sure you configure the name from email, example: xyz@helloworld.com, initialAdmins username will be ```xyz``
- Update the `principalDomain` to your company domain name.  Example from above, principalDomain should be ```helloworld.com```

{% note noteType="Warning" %}

It is important to leave the publicKeys configuration to have both Amazon Cognito public keys URL and OpenMetadata public keys URL. 

1. Amazon Cognito Public Keys are used to authenticate User's login
2. OpenMetadata JWT keys are used to authenticate Bot's login
3. Important to update the URLs documented in below configuration. The below config reflects a setup where all dependencies are hosted in a single host. Example openmetadata:8585 might not be the same domain you may be using in your installation.
4. OpenMetadata ships default public/private key, These must be changed in your production deployment to avoid any security issues.

For more details, follow [Enabling JWT Authenticaiton](deployment/security/enable-jwt-tokens)

{% /note %}

```shell
# OpenMetadata Server Authentication Configuration
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]  # Your `name` from name@domain.com
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org # Update with your domain

AUTHENTICATION_PROVIDER=custom-oidc
AUTHENTICATION_PUBLIC_KEYS=[{public key url}, http://openmetadata:8585/api/v1/system/config/jwks] # Update with your Public Key URL
AUTHENTICATION_AUTHORITY={issuer url} # Update with your Issuer URL
AUTHENTICATION_CLIENT_ID={Client ID} # Update with your Client ID
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

{% note noteType="Tip" %}
 Follow [this guide](/how-to-guides/feature-configurations/bots) to configure the `ingestion-bot` credentials for ingesting data using Connectors.
{% /note %}

## 2. Start Docker

```commandline
docker compose --env-file ~/openmetadata_onelogin.env up -d
```
