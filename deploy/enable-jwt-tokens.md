# Enable JWT Tokens

When we [enable SSO security](local-deployment/enable-security.md) on OpenMetadata, it will restrict access to all of the APIs. Users who want to access the UI will be redirected to configured SSO to log in, and SSO will provide the token to continue to make OpenMetadata REST API calls.

However, metadata ingestion or any other services which use OpenMetadata APIs to create entities or update them requires a token as well to authenticate. Typically, SSO offers service accounts for this very reason. OpenMetadata supports service accounts that the SSO provider supports. Please read the [docs](local-deployment/enable-security.md) to enable them.

In some cases, either creating a service account is not feasible, or the SSO provider itself doesn't support the service account. To address this gap, we shipped JWT token generation and authentication within OpenMetadata.



### Create Private / Public key&#x20;

To create private/public key use the following commands

```
openssl genrsa -out private_key.pem 2048   
openssl pkcs8 -topk8 -inform PEM -outform DER -in private_key.pem -out private_key.der -nocrypt
openssl rsa -in private_key.pem -pubout -outform DER -out public_key.der 
```

Copy the private\__key.der and public\_key.der in OpenMetadata server conf directory. Make sure the permissions can only be readable by the user who is starting OpenMetadata server._ &#x20;

__

### Configure OpenMetadata Server

To enable JWT token generation. Please add the following to the OpenMetadata server

```
jwtTokenConfiguration:
  rsapublicKeyFilePath: ${RSA_PUBLIC_KEY_FILE_PATH:-"/openmetadata/conf/public_key.der"}
  rsaprivateKeyFilePath: ${RSA_PRIVATE_KEY_FILE_PATH:-"/openmetadata/conf/private_key.der"}
  jwtissuer: ${JWT_ISSUER:-"open-metadata.org"}
  keyId: ${JWT_KEY_ID:-"Gb389a-9f76-gdjs-a92j-0242bk94356"}
```

if you are using helm charts or docker use the env variables to override the configs above.

Please use absolute path for public and private key files that we generated in previous steps.

Update JWT\__ISSUER to be the domain where you are running the OpenMetadata server.  Generate UUID64 id to configure JWT\_KEY\_ID. This should be generated once and keep it static even when you are updating the versions. Any change in this id will result in all the tokens issued so far to be invalid._

_Once you configure the above settings, restart OpenMetadata server ._

__

### Generate Token

Once the above configuration is updated, the server is restarted. Admin can go to Settings -> Bots page.

![](<../.gitbook/assets/image (168).png>)

Click on the generate token to create a token for the ingestion bot.

### Configure Ingestion

The generated token from the above page should pass onto the ingestion framework so that the ingestion can make calls securely to OpenMetadata. Make sure this token is not shared and stored securely.&#x20;

#### Using Airflow APIs

If you are using OpenMetadata shipped Airflow container with our APIs to deploy ingestion workflows from the OpenMetadata UIs. Configure the below section to enable JWT Token

```
airflowConfiguration:
  apiEndpoint: ${AIRFLOW_HOST:-http://localhost:8080}
  username: ${AIRFLOW_USERNAME:-admin}
  password: ${AIRFLOW_PASSWORD:-admin}
  metadataApiEndpoint: ${SERVER_HOST_API_URL:-http://localhost:8585/api}
  authProvider: ${AIRFLOW_AUTH_PROVIDER:-"no-auth"} # Possible values are "no-auth", "azure", "google", "okta", "auth0", "custom-oidc", "openmetadata"
  authConfig:
    azure:
      clientSecret: ${OM_AUTH_AIRFLOW_AZURE_CLIENT_SECRET:-""}
      authority: ${OM_AUTH_AIRFLOW_AZURE_AUTHORITY_URL:-""}
      scopes: ${OM_AUTH_AIRFLOW_AZURE_SCOPES:-[]}
      clientId:  ${OM_AUTH_AIRFLOW_AZURE_CLIENT_ID:-""}
    google:
      secretKey: ${OM_AUTH_AIRFLOW_GOOGLE_SECRET_KEY_PATH:- ""}
      audience: ${OM_AUTH_AIRFLOW_GOOGLE_AUDIENCE:-"https://www.googleapis.com/oauth2/v4/token"}
    okta:
      clientId: ${OM_AUTH_AIRFLOW_OKTA_CLIENT_ID:-""}
      orgURL: ${OM_AUTH_AIRFLOW_OKTA_ORGANIZATION_URL:-""}
      privateKey: ${OM_AUTH_AIRFLOW_OKTA_PRIVATE_KEY:-""}
      email: ${OM_AUTH_AIRFLOW_OKTA_SA_EMAIL:-""}
      scopes: ${OM_AUTH_AIRFLOW_OKTA_SCOPES:-[]}
    auth0:
      clientId: ${OM_AUTH_AIRFLOW_AUTH0_CLIENT_ID:-""}
      secretKey: ${OM_AUTH_AIRFLOW_AUTH0_CLIENT_SECRET:-""}
      domain: ${OM_AUTH_AIRFLOW_AUTH0_DOMAIN_URL:-""}
    customOidc:
      clientId: ${OM_AUTH_AIRFLOW_CUSTOM_OIDC_CLIENT_ID:-""}
      secretKey: ${OM_AUTH_AIRFLOW_CUSTOM_OIDC_SECRET_KEY_PATH:-""}
      tokenEndpoint: ${OM_AUTH_AIRFLOW_CUSTOM_OIDC_TOKEN_ENDPOINT_URL:-""}
    openmetadata:
      jwtToken: ${OM_AUTH_JWT_TOKEN:-""}
```

In the above configuration, configure **authProvider** to be "openmetadata" and configure OM\__AUTH\_JWT\_TOKEN with the JWT token generated in the bots page._

#### Using Ingestion Framework

If you are running your own Airflow and using the ingestion framework from OpenMetadata APIs. Add the below configuration to the workflow configuration you pass onto the ingestion framework

```
source:
  type: bigquery
  serviceName: local_bigquery
  serviceConnection:
    config:
      type: BigQuery
      credentials:
        gcsConfig:
          type: service_account
          projectId: project_id
          privateKeyId: private_key_id
          privateKey: private_key
          clientEmail: gcpuser@project_id.iam.gserviceaccount.com
          clientId: client_id
          authUri: https://accounts.google.com/o/oauth2/auth
          tokenUri: https://oauth2.googleapis.com/token
          authProviderX509CertUrl: https://www.googleapis.com/oauth2/v1/certs
          clientX509CertUrl: clientX509CertUrl
  sourceConfig:
    config:
      type: DatabaseMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
       jwtToken:
```

In the above section, under the workflowConfig, configure authProvider to be "openmetadata" and under securityConfig section, add "jwtToken" and its value from the ingestion bot page.
