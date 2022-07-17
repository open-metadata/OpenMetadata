---
title: Google SSO for Bare Metal
slug: /deployment/security/google/bare-metal
---

# Google SSO for Bare Metal

## Update conf/openmetadata.yaml

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
