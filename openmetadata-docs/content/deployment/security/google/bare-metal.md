---
title: Google SSO for Bare Metal
slug: /deployment/security/google/bare-metal
---

# Google SSO for Bare Metal

## Before 0.12.1

### Update conf/openmetadata.yaml

Once the `Client Id` and `Client Secret` are generated add the `Client Id` in `openmetadata.yaml` file in `client_id` field.

```yaml
authenticationConfiguration:
  provider: "google"
  publicKeyUrls:
    - "https://www.googleapis.com/oauth2/v3/certs"
  authority: "https://accounts.google.com"
  clientId: "{client id}"
  callbackUrl: "http://localhost:8585/callback"
```

Then, 
- Update `authorizerConfiguration` to add login names of the admin users in `adminPrincipals` section as shown below.
- Update the `principalDomain` to your company domain name.

```yaml
authorizerConfiguration:
  className: "org.openmetadata.catalog.security.DefaultAuthorizer"
  # JWT Filter
  containerRequestFilter: "org.openmetadata.catalog.security.JwtFilter"
  adminPrincipals:
    - "user1"
    - "user2"
  botPrincipals:
    - "ingestion-bot"
  principalDomain: "open-metadata.org"
```

Finally, update the Airflow information:

```yaml
airflowConfiguration:
  apiEndpoint: ${AIRFLOW_HOST:-http://localhost:8080}
  username: ${AIRFLOW_USERNAME:-admin}
  password: ${AIRFLOW_PASSWORD:-admin}
  metadataApiEndpoint: ${SERVER_HOST_API_URL:-http://localhost:8585/api}
  authProvider: google
  authConfig:
    google:
      secretKey: ${OM_AUTH_AIRFLOW_GOOGLE_SECRET_KEY_PATH:- ""}
      audience: ${OM_AUTH_AIRFLOW_GOOGLE_AUDIENCE:-"https://www.googleapis.com/oauth2/v4/token"}
```

## After 0.12.1

### Update conf/openmetadata.yaml

Once the `Client Id` and `Client Secret` are generated add the `Client Id` in `openmetadata.yaml` file in `client_id` field.

```yaml
authenticationConfiguration:
  provider: "google"
  publicKeyUrls:
    - "https://www.googleapis.com/oauth2/v3/certs"
  authority: "https://accounts.google.com"
  clientId: "{client id}"
  callbackUrl: "http://localhost:8585/callback"
```

Then,
- Update `authorizerConfiguration` to add login names of the admin users in `adminPrincipals` section as shown below.
- Update the `principalDomain` to your company domain name.

```yaml
authorizerConfiguration:
  className: "org.openmetadata.service.security.DefaultAuthorizer"
  # JWT Filter
  containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
  adminPrincipals:
    - "user1"
    - "user2"
  principalDomain: "open-metadata.org"
```

After that, update the Airflow information:

```yaml
airflowConfiguration:
  apiEndpoint: ${AIRFLOW_HOST:-http://localhost:8080}
  username: ${AIRFLOW_USERNAME:-admin}
  password: ${AIRFLOW_PASSWORD:-admin}
  metadataApiEndpoint: ${SERVER_HOST_API_URL:-http://localhost:8585/api}
```

Finally, set up the `ingestion-bot` from UI. Go to `Settings` > `Bots`.


- Click on `ingestion-bot`

<Image src="/images/deployment/security/google/click-bot.png" alt="click-bot" caption="Click on 'ingestion-bot'"/>

- Select `Google SSO` from the list.

<Image src="/images/deployment/security/google/select-google-sso.png" alt="select-google-sso" caption="Select 'Google SSO'"/>

- Configure it with your SSO values. Ensure that the account email of your SSO matches the one of the bot. 

<Image src="/images/deployment/security/google/configure-bot.png" alt="configure-bot" caption="Configure the ingestion-bot with your SSO values"/>

**Note**: 

1. **JWT Token auth mechanism**

If you decide to configure a JWT Token for the authentication mechanism ensure that you have also the value `http://localhost:8585/api/v1/config/jwks`
in your `publicKeyUrls` list:

```yaml
authenticationConfiguration:
  provider: "google"
  publicKeyUrls:
    - "https://www.googleapis.com/oauth2/v3/certs"
    - "http://localhost:8585/api/v1/config/jwks"
```

2. **Redeploying ingestion pipelines**

When the `ingestion-bot` is updated, we must redeploy our ingestion pipelines since the credentials used by the bot have been updated, 
and they will no longer be valid.