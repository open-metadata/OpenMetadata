---
title: Enable JWT Tokens | OpenMetadata Security Features
description: Enable JWT-based security for user authentication, session management, and platform API access using tokens.
slug: /deployment/security/enable-jwt-tokens
collate: false
---

# Enable JWT Tokens

When we [enable SSO security](/deployment/security) on OpenMetadata, it will restrict access to all the APIs. Users who want to access the UI
will be redirected to configured SSO to log in, and SSO will provide the token to continue to make OpenMetadata REST API
calls. 

However, metadata ingestion or any other services which use OpenMetadata APIs to create entities or update them
requires a token as well to authenticate. Typically, SSO offers service accounts for this very reason. OpenMetadata
supports service accounts that the SSO provider supports. Please read the [docs](/deployment/security) to enable them.

In some cases, either creating a service account is not feasible, or the SSO provider itself doesn't support the service account. To address
this gap, we shipped JWT token generation and authentication within OpenMetadata.

{% note %}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you have [Basic Authentication](/deployment/security/basic-auth) enabled.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

{% /note %}

## Create Private / Public key 

### For local/testing deployment

You can work with the existing configuration or generate private/public keys. By default, the `jwtTokenConfiguration` is shipped with OM.

### For production deployment

It is a **MUST** to update the JWT configuration. To create private/public key use the following commands can be used:

```commandline
openssl genrsa -out private_key.pem 2048   
openssl pkcs8 -topk8 -inform PEM -outform DER -in private_key.pem -out private_key.der -nocrypt
openssl rsa -in private_key.pem -pubout -outform DER -out public_key.der 
```

Copy the `private_key.der` and `public_key.der` in OpenMetadata server `conf` directory. Make sure the permissions can only be
readable by the user who is starting OpenMetadata server.

## Configure OpenMetadata Server

To enable JWT token generation. Please add the following to the OpenMetadata server

```yaml
jwtTokenConfiguration:
  rsapublicKeyFilePath: ${RSA_PUBLIC_KEY_FILE_PATH:-"/opt/openmetadata/conf/public_key.der"}
  rsaprivateKeyFilePath: ${RSA_PRIVATE_KEY_FILE_PATH:-"/opt/openmetadata/conf/private_key.der"}
  jwtissuer: ${JWT_ISSUER:-"open-metadata.org"}
  keyId: ${JWT_KEY_ID:-"Gb389a-9f76-gdjs-a92j-0242bk94356"}
```

If you are using helm charts or docker use the env variables to override the configs above.

Please use absolute path for public and private key files that we generated in previous steps.

Update the `JWT_ISSUER` to be the domain where you are running the OpenMetadata server. Generate `UUID64` id to configure
`JWT_KEY_ID`. This should be generated once and keep it static even when you are updating the versions. Any change in this
id will result in all the tokens issued so far to be invalid.

### Add public key URIS

```yaml
authenticationConfiguration:
  provider: ${AUTHENTICATION_PROVIDER:-no-auth}
  # This will only be valid when provider type specified is customOidc
  providerName: ${CUSTOM_OIDC_AUTHENTICATION_PROVIDER_NAME:-""}
  publicKeyUrls: ${AUTHENTICATION_PUBLIC_KEYS:-[{your SSO public keys URL}]}
  authority: ${AUTHENTICATION_AUTHORITY:-https://accounts.google.com}
  clientId: ${AUTHENTICATION_CLIENT_ID:-""}
  callbackUrl: ${AUTHENTICATION_CALLBACK_URL:-""}
  jwtPrincipalClaims: ${AUTHENTICATION_JWT_PRINCIPAL_CLAIMS:-[email,preferred_username,sub]}
```

add `{your domain}/api/v1/system/config/jwks` to `publicKeyUrls`. You should append to the existing configuration such that
your SSO and JWTToken auth verification will work. 

```yaml
  publicKeyUrls: ${AUTHENTICATION_PUBLIC_KEYS:-[{your SSO public keys URL}, {your domain}/api/v1/system/config/jwks]}
```

Once you configure the above settings, restart OpenMetadata server .

{% note %}

<h2>Note on JWKS url Network Reachbility</h2>

Make sure the above JWKS URI - `{your domain}/api/v1/system/config/jwks` is reachable from OpenMetadata Server Instance (VM or Docker Container or Kubernetes Pod). You can run the below command from the OpenMetadata Server to test it's reachility -

```
wget -O - {your domain}/api/v1/system/config/jwks
```

{% /note %}

## Generate Token

Once the above configuration is updated, the server is restarted. Admin can go to Settings -> Bots page.

{% image src="/images/v1.9/deployment/security/enable-jwt/settings-bot.png" alt="Settings Page" caption="Settings Page" /%} 

{% image src="/images/v1.9/deployment/security/enable-jwt/bot.png" alt="Bot settings page" caption="Bot settings page" /%} 

Click on the `ingestion-bot`. The current token can be revoked, or you can create a new one.

{% image src="/images/v1.9/deployment/security/enable-jwt/bot-jwt-token.png" alt="Bot credentials edition" caption="Edit JWT Token for ingestion-bot" /%} 

## Configure Ingestion

The generated token from the above page should pass onto the ingestion framework so that the ingestion can make calls
securely to OpenMetadata. Make sure this token is not shared and stored securely. 

### Running Ingestion from CLI

If you are running the ingestion from CLI. Add the below configuration to the workflow configuration you pass:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
       jwtToken: <jwt-token>
```

In the above section, under the `workflowConfig`, configure `authProvider` to be "openmetadata" and under `securityConfig`
section, add `jwtToken` and its value from the ingestion bot page.

## Configure JWT Key Pairs for Docker

Following the above documentation, you will have private key and public key pair available as mentioned [here](#create-private-public-key). Next, will proceed with the below section which will configure JWT token with docker environment.

### Create docker compose host volume mappings

Create a host directory which will be mapped as docker volumes to docker compose. This step will require you to update existing docker compose files that comes up with [OpenMetadata Releases](https://github.com/open-metadata/OpenMetadata/releases).


```yaml

services:
...
  openmetadata-server:
    volumes:
    - ./docker-volume/jwtkeys:/etc/openmetadata/jwtkeys
    ...
```

{% note %}

It is presumed with the above code snippet that you have `docker-volume` directory available on host where the docker-compose file is.

{% /note %}

### Update the docker compose environment variables with jwtkeys

Update the docker environment variables either directly in the docker-compose files or in a separate docker env files.
Below is a code snippet for how the docker env file will look like.

```bash
# openmetadata.prod.env
RSA_PUBLIC_KEY_FILE_PATH="/etc/openmetadata/jwtkeys/public_key.der"
RSA_PRIVATE_KEY_FILE_PATH="/etc/openmetadata/jwtkeys/private_key.der"
JWT_ISSUER="open-metadata.org" # update this as per your environment
JWT_KEY_ID="c8ec220c-be7d-4e47-97c7-098bf6a57ce1" # update this to a unique uuid4
```

### Run the docker compose command to start the services

Run the docker compose CLI command to start the docker services with the configured jwt keys.

```
docker compose -f docker-compose.yml --env-file openmetadata.prod.env up -d
```

## Configure JWT Key Pairs for Kubernetes

Following the above documentation, you will have private key and public key pair available as mentioned [here](#create-private-public-key). Next, will proceed with the below section which will configure JWT token with kubernetes environment.

### Create Kubernetes Secrets for the Key Pairs

Create Kubernetes Secrets from file using the kubernetes imperative  commands below.

```bash
kubectl create secret generic openmetadata-jwt-keys --from-file private_key.der --from-file public_key.der --namespace default
```

### Update Helm Values to mount Kubernetes secrets and configure JWT Token Configuration

Update your helm values to mount Kubernetes Secrets as Volumes and update the Jwt Token Configuration to point the Key File Paths to mounted path (absolute file path).

```yaml
# openmetadata.prod.values.yml
openmetadata:
  config:
    ...
    jwtTokenConfiguration:
      rsapublicKeyFilePath: "/etc/openmetadata/jwtkeys/public_key.der"
      rsaprivateKeyFilePath: "/etc/openmetadata/jwtkeys/private_key.der"
      jwtissuer: "open-metadata.org" # update this as per your environment
      keyId: "c8ec220c-be7d-4e47-97c7-098bf6a57ce1" # update this to a unique uuid4
  ...
extraVolumes:
- name: openmetadata-jwt-vol
  secret: 
    secretName: openmetadata-jwt-keys
extraVolumeMounts:
- name: openmetadata-jwt-vol
  mountPath: "/etc/openmetadata/jwtkeys"
  readOnly: true
```

{% note noteType="Warning" %}

It is recommended to consider new directory paths for mounting the secrets as volumes to OpenMetadata Server Pod.
With OpenMetadata Helm Charts, you will be able to add volumes and volumeMounts with `extraVolumes` and `extraVolumeMounts` helm values.

{% /note %}

### Install / Upgrade Helm Chart Release

Run the below command to make sure the update helm values are available to OpenMetadata.

```
helm upgrade --install openmetadata open-metadata/openmetadata --values openmetadata.prod.values.yml
```