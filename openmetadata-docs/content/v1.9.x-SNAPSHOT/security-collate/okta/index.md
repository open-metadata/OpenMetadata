---
title: Okta SSO
slug: /security/okta
collate: true
---

# Okta SSO

Follow the sections in this guide to set up Okta SSO.

{% note %}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Okta SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

{% /note %}

## Create Server Credentials

This document will explain how to create an Okta app and configure it for OAuth. This will generate the information required for Single Sign On with Okta.

### Step 1: Create an Okta Account
- Go to [Create Okta Account](https://developer.okta.com/signup/).
- Provide the required input and click on Sign Up.
- Else you can continue with Google or GitHub.

### Step 2: Create the OIDC App Integration.
- Once done with **Signup/Sign** in, you will be redirected to the **Getting Started** page in Okta.
{% image src="/images/v1.9/deployment/security/okta/create-oidc-app-integration.png" alt="create-oidc-app-integration" /%}

- Click on **Applications -> Applications** in the left navigation panel.
{% image src="/images/v1.9/deployment/security/okta/click-applications.png" alt="click-applications" /%}

- Click on the **Create App Integration** button.
{% image src="/images/v1.9/deployment/security/okta/create-app-integration.png" alt="create-app-integration" /%}

### Step 3: Configuring the App
- Once you are in the **Create a new app integration** page, select **OIDC - OpenID Connect**.
- Next, select the **Application type -> Single-Page Application**.
- Once selected, click **Next**.
{% image src="/images/v1.9/deployment/security/okta/configuring-the-app.png" alt="configuring-the-app" /%}

- From the **General Settings** page,
  * Enter an **App integration name**
  * Select the following in **Grant type**:
    * **Authorization Code**
    * **Refresh Token** - For the refresh token behavior, it is recommended to select the option to 'Rotate token after every use'.
    * **Implicit (hybrid)** - Select the options to allow ID Token and Access Token with implicit grant type.
  * Enter the **Sign-in redirect URIs**
    * https://{your-collate-domain}/callback
    * https://{your-collate-domain}/silent-callback
  * Enter the **Sign-out redirect URIs**
  * Enter the **Base URIs**
  * Select the required option for **Controlled access**
- Click **Save**.
{% image src="/images/v1.9/deployment/security/okta/general-settings-click-save.png" alt="general-settings-click-save" /%}

- The app is now configured.
{% image src="/images/v1.9/deployment/security/okta/app-is-configured.png" alt="app-is-configured" /%}

### Step 4: Add Authorization Server to get the Issuer URL
#### New Authorization Server 
It is recommended to create a separate authorization server for different applications. The authorization server needs an endpoint, which'll be the Issuer URL.
- Click on **Security -> API** in the left navigation panel.
{% image src="/images/v1.9/deployment/security/okta/click-security-api.png" alt="click-security-api" /%}

- From the **Authorization Servers** tab, click on **Add Authorization Server** button.
{% image src="/images/v1.9/deployment/security/okta/click-add-authorization-server.png" alt="click-add-authorization-server" /%}

- Enter a Name and Description.
- While creating the authorization server, an **Audience** must be provided for the server. The Audience is the **Client ID** of the single page application that was created. Refer the next Step 7 to locate the Client ID.
- **Save** the changes.
{% image src="/images/v1.9/deployment/security/okta/add-auth-server-save-changes.png" alt="add-auth-server-save-changes" /%}

This will generate the Issuer URL.
#### Default Authorization Server (not recommended )
It is recommended to create a separate authorization server for different applications. The authorization server needs an endpoint, which'll be the Issuer URL.
- Click on **Security -> API** in the left navigation panel.
{% image src="/images/v1.9/deployment/security/okta/click-security-api.png" alt="click-security-api" /%}

- From the **Authorization Servers** tab, click on **default** server.
{% image src="/images/v1.9/deployment/security/okta/default-server.png" alt="default-server" /%}


### Step 5: Change the Issuer URL from Dynamic to Okta URL
Once the Authorization Server has been added, navigate to Security >> API >> Authorization Servers and click on the authorization server created in the previous step.
{% image src="/images/v1.9/deployment/security/okta/click-auth-server-from-prev-step.png" alt="click-auth-server-from-prev-step" /%}

The Issuer URL shows up as Dynamic by default. Change the Issuer URL to Okta URL and save the changes.
{% image src="/images/v1.9/deployment/security/okta/change-issuer-url.png" alt="change-issuer-url" /%}

### Step 6: Create a Default Scope
- To create a default scope from **Security -> API**, click on the required **Authorization Server**.
{% image src="/images/v1.9/deployment/security/okta/click-req-auth-server.png" alt="click-req-auth-server" /%}

- In the resulting page, click on the **Scopes** tab
- Click on **Add Scope**
{% image src="/images/v1.9/deployment/security/okta/add-scope.png" alt="add-scope" /%}

- Set as a **Default Scope**.
{% image src="/images/v1.9/deployment/security/okta/set-default-scope.png" alt="set-default-scope" /%}

### Step 7: Add New Access Policy and Rule
- From **Security -> API**, click on the required **Authorization Server**
- Navigate to the **Access Policies Tab**
- Click on **Add New Access Policy**
{% image src="/images/v1.9/deployment/security/okta/add-new-access-policy.png" alt="add-new-access-policy" /%}

- To create a policy, add a Name and Description.
- Assign the policy to the required clients.
{% image src="/images/v1.9/deployment/security/okta/assign-policy.png" alt="" /%}

- Add a new **Rule** inside the policy as required. Rules can be created with just a few grant type details, such as Client Credentials, Authorization Code, Device Authorization, and Token Exchange.
- Click on **Create Rule** to save the changes.
{% image src="/images/v1.9/deployment/security/okta/add-rule.png" alt="add-rule" /%}

### Step 8: Where to Find the Credentials
- Once the app is configured, the **Client ID** can be used.
- You can also go to **Application -> Application** as in step 2.
- You should be able to see your application in the list.
{% image src="/images/v1.9/deployment/security/okta/see-your-application.png" alt="see-your-application" /%}

- Click on your application.
- You will find your **Client ID** and **Okta domain**.
- The **Client authentication** is enabled by default.
- By clicking on the Edit **** option for General Settings, you can deselect the option for **User consent**. Save the changes.
{% image src="/images/v1.9/deployment/security/okta/deselect-user-consent.png" alt="deselect-user-consent" /%}

- Click on the **Sign On** tab from the top navigation bar.
- Click on Edit for **OpenID Connect ID Token**.
- For **Issuer**, change from the Dynamic (based on request domain) option to the **Okta URL** option.
- The **Audience** is the same as the Client ID.

{% image src="/images/v1.9/deployment/security/okta/click-edit-token.png" alt="click-edit-token" /%}

You will need to share the following information with the Collate team:
- Issuer URL
- Client ID
