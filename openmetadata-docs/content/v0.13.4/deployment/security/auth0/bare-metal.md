---
title: Auth0 SSO for Bare Metal
slug: /deployment/security/auth0/bare-metal
---

# Auth0 SSO for Bare Metal

## Update conf/openmetadata.yaml

Once the `Client Id` and `Client Secret` are generated add the `Client Id` in `openmetadata.yaml` file in `client_id` field.

```yaml
authenticationConfiguration:
  provider: "auth0"
  publicKeyUrls: 
    - "https://parth-panchal.us.auth0.com/.well-known/jwks.json"
  authority: "https://parth-panchal.us.auth0.com/"
  clientId: "{Client ID}"
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

In `0.12.1` the `className` and `containerRequestFilter` must replace `org.openmetadata.catalog` by `org.openmetadata.service`.

Finally, update the Airflow information:

**Before 0.12.1**

```yaml
airflowConfiguration:
  apiEndpoint: ${AIRFLOW_HOST:-http://localhost:8080}
  username: ${AIRFLOW_USERNAME:-admin}
  password: ${AIRFLOW_PASSWORD:-admin}
  metadataApiEndpoint: ${SERVER_HOST_API_URL:-http://localhost:8585/api}
  authProvider: auth0
  authConfig:
    auth0:
      clientId: ${OM_AUTH_AIRFLOW_AUTH0_CLIENT_ID:-""}
      secretKey: ${OM_AUTH_AIRFLOW_AUTH0_CLIENT_SECRET:-""}
      domain: ${OM_AUTH_AIRFLOW_AUTH0_DOMAIN_URL:-""}
```

**After 0.12.1**

```yaml
airflowConfiguration:
  apiEndpoint: ${AIRFLOW_HOST:-http://localhost:8080}
  username: ${AIRFLOW_USERNAME:-admin}
  password: ${AIRFLOW_PASSWORD:-admin}
  metadataApiEndpoint: ${SERVER_HOST_API_URL:-http://localhost:8585/api}
```

**Note:** Follow [this](/how-to-guides/feature-configurations/bots) guide to configure the `ingestion-bot` credentials for
ingesting data from Airflow.
