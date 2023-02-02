---
title: OneLogin SSO
slug: /deployment/security/one-login
---

# OneLogin SSO

Follow the sections in this guide to set up OneLogin SSO.

## Create Server Credentials

### Step 1: Configure a new Application

- Login to [OneLogin](https://www.onelogin.com/) as an administrator and click on Applications

<Image src="/images/deployment/security/one-login/create-server-credentials-1.png" alt="create-account"/>

- Click on the `Add App` button and search for `openid connect`
- Select the `OpenId Connect (OIDC)` app

<Image src="/images/deployment/security/one-login/create-server-credentials-2.png" alt="create-account"/>

- Change the Display Name of the app to `Open Metadata` and click `Save`

<Image src="/images/deployment/security/one-login/create-server-credentials-3.png" alt="create-account"/>

- Configure the login Url (`http(s)://<domain>/signin`) and redirect URI (`http(s)://<domain>/callback`) as shown below

<Image src="/images/deployment/security/one-login/create-server-credentials-4.png" alt="create-account"/>

- Configure the users in the organization that can access OpenMetadata app by clicking on the `Users`

<Image src="/images/deployment/security/one-login/create-server-credentials-5.png" alt="create-account"/>

- Click on "SSO" and select `None (PKCE)` for Token Endpoint.

<Image src="/images/deployment/security/one-login/create-server-credentials-6.png" alt="create-account"/>

### Step 2: Where to find the Credentials

- Go to "SSO" and copy the Client ID 

<Image src="/images/deployment/security/one-login/create-server-credentials-7.png" alt="create-account"/>

- Copy the Issuer URL

## Create Service Account (optional)

This step is optional if you configure the ingestion-bot with the JWT Token, you can follow the documentation of 
[Enable JWT Tokens](/deployment/security/enable-jwt-tokens).

### Create Secret Key

- Navigate to "SSO" settings of the application and click on `Show client secret` to copy the secret key

<Image src="/images/deployment/security/one-login/create-service-account.png" alt="create-account"/>

After the applying these steps, you can update the configuration of your deployment:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/one-login/docker"
  >
    Configure OneLogin SSO for your Docker Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/one-login/bare-metal"
  >
    Configure OneLogin SSO for your Bare Metal Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Kubernetes Security"
    href="/deployment/security/one-login/kubernetes"
  >
    Configure OneLogin SSO for your Kubernetes Deployment.
  </InlineCallout>
</InlineCalloutContainer>

## Configure Ingestion

After everything has been set up, you will need to configure your workflows if you are running them via the
`metadata` CLI or with any custom scheduler.

Note that OneLogin SSO is a layer on top of Custom OIDC.

When setting up the YAML config for the connector, update the `workflowConfig` as follows:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: custom-oidc
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

<Important>

Security requirements for your **production** environment:
- **DELETE** de admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with OneLogin SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide 
by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

</Important>
