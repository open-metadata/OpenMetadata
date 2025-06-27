---
title: Keycloak SSO
slug: /security/keycloak
collate: true
---

# Keycloak SSO

Follow the sections in this guide to set up Keycloak SSO.

{% note %}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Keycloak SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

{% /note %}

## Create Server Credentials

### Step 1: Access the Keycloak Admin Console

- You need an administrator account. If you don't have, see [Creating the first administrator](https://www.keycloak.org/docs/latest/server_admin/#creating-first-admin_server_administration_guide).
- Go to the URL for the Admin Console. For example, for localhost, use this URL: http://localhost:8080/admin/

{% image src="/images/v1.9/deployment/security/keycloak/1-login-page.png" alt="login-page" /%}

- Enter the username and password you created.

### Step 2: Change Realm selected
- The Keycloak use Realms as the primary form of organization, we can't use the realm "master" for new clients (apps), only for administration, so change for your specific realm or create a new.
- In this example we are used an existing one called "Data-sec".

{% image src="/images/v1.9/deployment/security/keycloak/2-change-realm.png" alt="change-realm" /%}

### Step 3: Create OpenMetadata as a new Client
- Click on `Clients` in the menu.
- Click on `Create` button.
- Enter the Client ID and Protocol as the image.
- Click on `Save` button.

{% image src="/images/v1.9/deployment/security/keycloak/3-add-client.png" alt="add-client" /%}

### Step 4: Edit settings of the client
- Change "Access Type" value from "public" to "confidential".
- Change "implicit flow" and "service accounts" to enabled.

{% image src="/images/v1.9/deployment/security/keycloak/4-edit-settings-client.png" alt="edit-settings-client" /%}

- At the bottom of the same settings page, change the configurations to the openmetadata address.
- The image below shows different possibilities, such as running locally or with a custom domain.

{% image src="/images/v1.9/deployment/security/keycloak/5-edit-settings-url.png" alt="edit-settings-url.png" /%}

- Click on `Save` button.

{% note %}

Note: Scopes `openid`, `email` & `profile` are required to fetch the user details so you will have to add these scopes in your client.

{% /note %}

### Step 5: Where to Find the Credentials

- Navigate to the `Credentials` tab.
- You will find your Client `Secret` related to the Client id "open-metadata"

{% image src="/images/v1.9/deployment/security/keycloak/6-client-credentials.png" alt="client-credentials" /%}

You will need to share the following information with the Collate team:
- Client ID
