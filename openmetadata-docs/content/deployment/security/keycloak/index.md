---
title: Keycloak SSO
slug: /deployment/security/keycloak
---

# Keycloak SSO

Follow the sections in this guide to set up Keycloak SSO.

<Important>

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Keycloak SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

</Important>

## Create Server Credentials

### Step 1: Access the Keycloak Admin Console

- You need an administrator account. If you don't have, see [Creating the first administrator](https://www.keycloak.org/docs/latest/server_admin/#creating-first-admin_server_administration_guide).
- Go to the URL for the Admin Console. For example, for localhost, use this URL: http://localhost:8080/admin/

<Image src="/images/deployment/security/keycloak/1-login-page.png" alt="login-page"/>

- Enter the username and password you created.

### Step 2: Change Realm selected
- The Keycloak use Realms as the primary form of organization, we can't use the realm "master" for new clients (apps), only for administration, so change for your specific realm or create a new.
- In this example we are used an existing one called "Data-sec".

<Image src="/images/deployment/security/keycloak/2-change-realm.png" alt="change-realm"/>

### Step 3: Create OpenMetadata as a new Client
- Click on `Clients` in the menu.
- Click on `Create` button.
- Enter the Client ID and Protocol as the image.
- Click on `Save` button.

<Image src="/images/deployment/security/keycloak/3-add-client.png" alt="add-client"/>

### Step 4: Edit settings of the client
- Change "Acess Type" value from "public" to "confidential".
- Change "implicit flow" and "service accounts" to enabled.

<Image src="/images/deployment/security/keycloak/4-edit-settings-client.png" alt="edit-settings-client"/>

- At the bottom of the same settings page, change the configurations to the openmetadata address.
- The image below shows different possibilities, such as running locally or with a custom domain.

<Image src="/images/deployment/security/keycloak/5-edit-settings-url.png" alt="edit-settings-url.png"/>

- Click on `Save` button.

<Note>

Note: You need to add the `openid`, `email` & `profile` scopes for your scope.

</Note>


<Note>

Configuring a service account in Keycloak is optional if you configure the ingestion-bot with
the JWT Token, you can follow the documentation of [Enable JWT Tokens](/deployment/security/enable-jwt-tokens).

</Note>

### Step 5: Where to Find the Credentials

- Navigate to the `Credentials` tab.
- You will find your Client `Secret` related to the Client id "open-metadata"

<Image src="/images/deployment/security/keycloak/6-client-credentials.png" alt="client-credentials"/>

- Navigate to the `Service Account Roles` tab.
- You will find your service account id related to the Client id "open-metadata"

<Image src="/images/deployment/security/keycloak/7-client-service-account.png" alt="client-service-account.png"/>

After the applying these steps, the users in your realm are able to login in the openmetadata, as a suggestion create a user called "admin-user". Now you can update the configuration of your deployment:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/keycloak/docker"
  >
    Configure Keycloak SSO for your Docker Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/keycloak/bare-metal"
  >
    Configure Keycloak SSO for your Bare Metal Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Kubernetes Security"
    href="/deployment/security/keycloak/kubernetes"
  >
    Configure Keycloak SSO for your Kubernetes Deployment.
  </InlineCallout>
</InlineCalloutContainer>

## Configure Ingestion

After everything has been set up, you will need to configure your workflows if you are running them via the
`metadata` CLI or with any custom scheduler.

Note that KeyCloak SSO is a layer on top of Custom OIDC.

When setting up the YAML config for the connector, update the `workflowConfig` as follows:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: custom-oidc
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      tokenEndpoint: '{your_token_endpoint}' # e.g. http://localhost:8081/realms/data-sec/protocol/openid-connect/token
```

<Note>
A dockerized demo for showing how this SSO works with OpenMetadata can be found [here](https://github.com/open-metadata/openmetadata-demo/tree/main/keycloak-sso).
</Note>