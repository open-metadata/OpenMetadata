---
title: Custom OIDC SSO for Bare Metal
slug: /deployment/security/custom-oidc/bare-metal
---

# Custom OIDC SSO for Bare Metal

## Update conf/openmetadata.yaml

Once the `Client Id` and `Client Secret` are generated add the `Client Id` in `openmetadata.yaml` file in `client_id` field.

Update the `providerName` config to the name you want to display in the `Sign In` button in the UI. For example, with the
following configuration with `providerName` set to `KeyCloak`, the users will see `Sign In with KeyCloak SSO` in the `Sign In`
page of the OpenMetadata UI.

```yaml
authenticationConfiguration:
  provider: "custom-oidc"
  providerName: "KeyCloak"
  publicKeyUrls:
    - "http://localhost:8080/realms/myrealm/protocol/openid-connect/certs"
  authority: "http://localhost:8080/realms/myrealm"
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
  authProvider: custom-oidc
  customOidc:
    clientId: ${OM_AUTH_AIRFLOW_CUSTOM_OIDC_CLIENT_ID:-""}
    secretKey: ${OM_AUTH_AIRFLOW_CUSTOM_OIDC_SECRET_KEY_PATH:-""}
    tokenEndpoint: ${OM_AUTH_AIRFLOW_CUSTOM_OIDC_TOKEN_ENDPOINT_URL:-""}
```
