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
    - "https://{your domain}/api/v1/system/config/jwks" # Update with your Domain and Make sure this "/api/v1/system/config/jwks" is always configured to enable JWT tokens
  authority: "{ISSUER_URL}"
  clientId: "{CLIENT_ID - SPA APP}"
  callbackUrl: "https://{your domain}/callback"
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

```yaml
pipelineServiceClientConfiguration:
  apiEndpoint: ${PIPELINE_SERVICE_CLIENT_ENDPOINT:-http://localhost:8080}
  metadataApiEndpoint: ${SERVER_HOST_API_URL:-https://{your domain}/api}
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

{% note %}

`AUTHENTICATION_PUBLIC_KEYS` and `AUTHENTICATION_CALLBACK_URL` refers to https://{your domain} this is referring to your OpenMetdata installation domain name
and please make sure to correctly put http or https depending on your installation.

{% /note %}

**Note:** Follow [this](/developers/bots) guide to configure the `ingestion-bot` credentials for
ingesting data from Airflow.