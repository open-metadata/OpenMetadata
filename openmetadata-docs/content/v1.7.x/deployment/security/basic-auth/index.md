---
title: Basic Authentication | OpenMetadata Security Setup
slug: /deployment/security/basic-auth
collate: false
---

# UserName/Password Login

Out of the box, OpenMetadata comes with a Username & Password Login Mechanism.

The default Username and Password for Login are:

```commandline
Username - admin@open-metadata.org
Password - admin
```
When using a custom domain, configure the principal domain as follows:

```yaml
config:
    authorizer:
      adminPrincipals: [admin]
      principalDomain: "yourdomain.com"
```

With this setup, the default Username will be `admin@yourdomain.com`.

{%important%}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens) in case it is enabled.

{%/important%}

# Setting up Basic Auth Manually

Below are the required steps to set up the Basic Login:

## Set up Configurations in openmetadata.yaml

### Authentication Configuration

The following configuration controls the auth mechanism for OpenMetadata. Update the mentioned fields as required.

```yaml
authenticationConfiguration:
  provider: ${AUTHENTICATION_PROVIDER:-basic}
  publicKeyUrls: ${AUTHENTICATION_PUBLIC_KEYS:-[{your domain}/api/v1/system/config/jwks]} # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
  authority: ${AUTHENTICATION_AUTHORITY:-https://accounts.google.com}
  enableSelfSignup : ${AUTHENTICATION_ENABLE_SELF_SIGNUP:-true}
```

For the Basic auth we need to set:
 
-  `provider`: basic
-  `publicKeyUrls`: {http|https}://{your_domain}:{port}}/api/v1/system/config/jwks
-  `authority`: {your_domain}
-  `enableSelfSignup`: This flag indicates if users can come and signup by themselves on the OM

### Authorizer Configuration

This configuration controls the authorizer for OpenMetadata:

```yaml
authorizerConfiguration:
  adminPrincipals: ${AUTHORIZER_ADMIN_PRINCIPALS:-[admin]}
  allowedEmailRegistrationDomains: ${AUTHORIZER_ALLOWED_REGISTRATION_DOMAIN:-["all"]}
  principalDomain: ${AUTHORIZER_PRINCIPAL_DOMAIN:-"open-metadata.org"}
```

For the Basic auth we need to set:

- `adminPrincipals`: admin usernames to bootstrap the server with, comma-separated values.
- `allowedEmailRegistrationDomains`: This controls what all domain are allowed for email registration can be your {principalDomain} as well, for example gmail.com, outlook.comm etc.
- `principalDomain`: This controls what all domain are allowed for email registration, for example gmail.com, outlook.comm etc. When `AUTHORIZER_ENFORCE_PRINCIPAL_DOMAIN` is set to `true`, only users with email addresses from the `AUTHORIZER_PRINCIPAL_DOMAIN` can log in.

{%note%}

Please note the following are the formats to bootstrap admins on server startup: `[admin1,admin2,admin3]`

This works for SMTP-enabled servers, Login Password for these are generated randomly and sent to the mail `adminName`@`principalDomain`. 

If SMTP is not enabled for OpenMetadata, please use the method below to create admin users: `[admin1, admin2, admin3]`. The default password for all admin users will be admin.

After logging into the OpenMetadata UI, admin users can change their default password by navigating to `Settings > Members > Admins`.

{%/note%}

## Metadata Ingestion

For ingesting metadata when Basic Auth is enabled, it is mandatory to configure the `ingestion-bot` account with the JWT 
configuration. To know how to enable it, you can follow the documentation of [Enable JWT Tokens](/deployment/security/enable-jwt-tokens).

{% partial file="/v1.7/deployments/smtp-email.md" /%}

{% partial file="/v1.7/deployment/configure-ingestion.md" /%}
