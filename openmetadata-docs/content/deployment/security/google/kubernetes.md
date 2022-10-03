---
title: Google SSO for Kubernetes
slug: /deployment/security/google/kubernetes
---

# Google SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` and `Client Secret` are generated, see the snippet below for an example of where to
place the client id value and update the authorizer configurations in the `values.yaml`.

## Before 0.12.1

```yaml
global:
  authorizer:
    className: "org.openmetadata.catalog.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
    initialAdmins:
      - "user1"
      - "user2"
    botPrincipals:
      - "<service_application_client_id>"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "google"
    publicKeys:
      - "https://www.googleapis.com/oauth2/v3/certs"
    authority: "https://accounts.google.com"
    clientId: "{client id}"
    callbackUrl: "http://localhost:8585/callback"
  airflow:
    openmetadata:
      authProvider: "google"
      google:
        # absolute path of secret file on airflow instance
        secretKeyPath: ""
        audience: "https://www.googleapis.com/oauth2/v4/token"
```

## After 0.12.1

```yaml
global:
  authorizer:
    className: "org.openmetadata.catalog.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
    initialAdmins:
      - "user1"
      - "user2"
    botPrincipals:
      - "<service_application_client_id>"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "google"
    publicKeys:
      - "https://www.googleapis.com/oauth2/v3/certs"
    authority: "https://accounts.google.com"
    clientId: "{client id}"
    callbackUrl: "http://localhost:8585/callback"
```

### Set up the `ingestion-bot`

In 0.12.1, we must set up the `ingestion-bot` from UI from `Settings` > `Bots`.

- Click on `ingestion-bot`

<Image src="/images/deployment/security/google/click-bot.png" alt="click-bot" caption="Click on 'ingestion-bot'"/>

- Select `Google SSO` from the list.

<Image src="/images/deployment/security/google/select-google-sso.png" alt="select-google-sso" caption="Select 'Google SSO'"/>

- Configure it with your SSO values. Ensure that the account email of your SSO matches the one of the bot.

<Image src="/images/deployment/security/google/configure-bot.png" alt="configure-bot" caption="Configure the ingestion-bot with your SSO values"/>

**Note**:

1. **JWT Token auth mechanism**

If you decide to configure a JWT Token for the authentication mechanism ensure that you have also the value `http://localhost:8585/api/v1/config/jwks`
in your `publicKeys` list:

```yaml
global:
  authentication:
    publicKeys:
      - "https://www.googleapis.com/oauth2/v3/certs"
      - "http://localhost:8585/api/v1/config/jwks" 
```

2. **Redeploying ingestion pipelines**

When the `ingestion-bot` is updated, we must redeploy our ingestion pipelines since the credentials used by the bot have been updated,
and they will no longer be valid.
