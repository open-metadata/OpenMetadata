---
title: Okta SSO for Bare Metal
slug: /deployment/security/okta/bare-metal
collate: false
---

# Okta SSO for Bare Metal

## Update conf/openmetadata.yaml

Once the `Client Id` is generated, add the `Client Id` in `openmetadata.yaml` file in `client_id` field.

```yaml
authenticationConfiguration:
  provider: "okta"
  publicKeyUrls:
    - "{ISSUER_URL}/v1/keys"
    - "{your domain}/api/v1/system/config/jwks" # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
  authority: "{ISSUER_URL}"
  clientId: "{CLIENT_ID - SPA APP}"
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
  authProvider: okta
  authConfig:
    okta:
      clientId: ${OM_AUTH_AIRFLOW_OKTA_CLIENT_ID:-""}
      orgURL: ${OM_AUTH_AIRFLOW_OKTA_ORGANIZATION_URL:-""}
      privateKey: ${OM_AUTH_AIRFLOW_OKTA_PRIVATE_KEY:-""}
      email: ${OM_AUTH_AIRFLOW_OKTA_SA_EMAIL:-""}
      scopes: ${OM_AUTH_AIRFLOW_OKTA_SCOPES:-[]}
```

**After 0.12.1**

```yaml
pipelineServiceClientConfiguration:
  apiEndpoint: ${PIPELINE_SERVICE_CLIENT_ENDPOINT:-http://localhost:8080}
  metadataApiEndpoint: ${SERVER_HOST_API_URL:-http://localhost:8585/api}
  ingestionIpInfoEnabled: ${PIPELINE_SERVICE_IP_INFO_ENABLED:-false}
  hostIp: ${PIPELINE_SERVICE_CLIENT_HOST_IP:-""}
  healthCheckInterval: ${PIPELINE_SERVICE_CLIENT_HEALTH_CHECK_INTERVAL:-300}
  verifySSL: ${PIPELINE_SERVICE_CLIENT_VERIFY_SSL:-"no-ssl"} # Possible values are "no-ssl", "ignore", "validate"
  sslConfig:
    certificatePath: ${PIPELINE_SERVICE_CLIENT_SSL_CERT_PATH:-""} # Local path for the Pipeline Service Client

  # Default required parameters for Airflow as Pipeline Service Client
  parameters:
    username: ${AIRFLOW_USERNAME:-admin}
    password: ${AIRFLOW_PASSWORD:-admin}
    timeout: ${AIRFLOW_TIMEOUT:-10}
    # If we need to use SSL to reach Airflow
    truststorePath: ${AIRFLOW_TRUST_STORE_PATH:-""}
    truststorePassword: ${AIRFLOW_TRUST_STORE_PASSWORD:-""}
```

**Note:** Follow [this](/developers/bots) guide to configure the `ingestion-bot` credentials for
ingesting data from Airflow.