---
title: Okta SSO (Docker) | OpenMetadata Deployment Guide
description: Configure Okta Authorization Code Flow to handle secure user login through backend token validation and maintain session integrity in web platforms.
slug: /deployment/security/okta/auth-code-flow
collate: false
---

# Auth Code Flow

### Step 1: Configuring the App
- Once you are in the **Create a new app integration** page, select **OIDC - OpenID Connect**.
- Next, select the **Application type -> Web Application**.
- Once selected, click **Next**.
{% image src="/images/v1.10/deployment/security/okta/okta-auth-code-1.png" alt="configuring-the-app" /%}

- From the **General Settings** page,
  * Enter an **App integration name**
  * Select the following in **Grant type**:
    * **Authorization Code**
    * **Refresh Token** - For the refresh token behavior, it is recommended to select the option to 'Rotate token after every use'.
    * **Implicit (hybrid)** - Select the options to allow ID Token and Access Token with implicit grant type.
  * Enter the **Sign-in redirect URIs**
    * http://localhost:8585/callback
    * http://localhost:8585/silent-callback
  * Enter the **Sign-out redirect URIs**
  * Enter the **Base URIs**
  * Select the required option for **Controlled access**
- Click **Save**.
{% image src="/images/v1.10/deployment/security/okta/okta-auth-code-2.png" alt="general-settings-click-save" /%}

- The app is now configured.
{% image src="/images/v1.10/deployment/security/okta/okta-auth-code-3.1.png" alt="app-is-configured" /%}
{% image src="/images/v1.10/deployment/security/okta/okta-auth-code-3.2.png" alt="app-is-configured" /%}

### Step 2: Add Authorization Server to get the Issuer URL
#### New Authorization Server 
It is recommended to create a separate authorization server for different applications. The authorization server needs an endpoint, which'll be the Issuer URL.
- Click on **Security -> API** in the left navigation panel.
{% image src="/images/v1.10/deployment/security/okta/click-security-api.png" alt="click-security-api" /%}

- From the **Authorization Servers** tab, click on **Add Authorization Server** button.
{% image src="/images/v1.10/deployment/security/okta/click-add-authorization-server.png" alt="click-add-authorization-server" /%}

- Enter a Name and Description.
- While creating the authorization server, an **Audience** must be provided for the server. The Audience is the **Client ID** of the single page application that was created. Refer the next Step 7 to locate the Client ID.
- **Save** the changes.
{% image src="/images/v1.10/deployment/security/okta/add-auth-server-save-changes.png" alt="add-auth-server-save-changes" /%}

This will generate the Issuer URL.
#### Default Authorization Server (not recommended )
It is recommended to create a separate authorization server for different applications. The authorization server needs an endpoint, which'll be the Issuer URL.
- Click on **Security -> API** in the left navigation panel.
{% image src="/images/v1.10/deployment/security/okta/click-security-api.png" alt="click-security-api" /%}

- From the **Authorization Servers** tab, click on **default** server.
{% image src="/images/v1.10/deployment/security/okta/default-server.png" alt="default-server" /%}


### Step 3: Change the Issuer URL from Dynamic to Okta URL
Once the Authorization Server has been added, navigate to Security >> API >> Authorization Servers and click on the authorization server created in the previous step.
{% image src="/images/v1.10/deployment/security/okta/click-auth-server-from-prev-step.png" alt="click-auth-server-from-prev-step" /%}

The Issuer URL shows up as Dynamic by default. Change the Issuer URL to Okta URL and save the changes.
{% image src="/images/v1.10/deployment/security/okta/change-issuer-url.png" alt="change-issuer-url" /%}

### Step 4: Create a Default Scope
- To create a default scope from **Security -> API**, click on the required **Authorization Server**.
{% image src="/images/v1.10/deployment/security/okta/click-req-auth-server.png" alt="click-req-auth-server" /%}

- In the resulting page, click on the **Scopes** tab
- Click on **Add Scope**
{% image src="/images/v1.10/deployment/security/okta/add-scope.png" alt="add-scope" /%}

- Set as a **Default Scope**.
{% image src="/images/v1.10/deployment/security/okta/set-default-scope.png" alt="set-default-scope" /%}

### Step 5: Add New Access Policy and Rule
- From **Security -> API**, click on the required **Authorization Server**
- Navigate to the **Access Policies Tab**
- Click on **Add New Access Policy**
{% image src="/images/v1.10/deployment/security/okta/add-new-access-policy.png" alt="add-new-access-policy" /%}

- To create a policy, add a Name and Description.
- Assign the policy to the required clients.
{% image src="/images/v1.10/deployment/security/okta/assign-policy.png" alt="" /%}

- Add a new **Rule** inside the policy as required. Rules can be created with just a few grant type details, such as Client Credentials, Authorization Code, Device Authorization, and Token Exchange.
- Click on **Create Rule** to save the changes.
{% image src="/images/v1.10/deployment/security/okta/add-rule.png" alt="add-rule" /%}

### Step 6: Where to Find the Credentials
- Once the app is configured, the **Client ID** can be used.
- You can also go to **Application -> Application** as in step 2.
- You should be able to see your application in the list.
{% image src="/images/v1.10/deployment/security/okta/see-your-application.png" alt="see-your-application" /%}

- Click on your application.
- You will find your **Client ID** and **Okta domain**.
- The **Client authentication** is enabled by default.
- By clicking on the Edit **** option for General Settings, you can deselect the option for **User consent**. Save the changes.
{% image src="/images/v1.10/deployment/security/okta/deselect-user-consent.png" alt="deselect-user-consent" /%}

- Click on the **Sign On** tab from the top navigation bar.
- Click on Edit for **OpenID Connect ID Token**.
- For **Issuer**, change from the Dynamic (based on request domain) option to the **Okta URL** option.
- The **Audience** is the same as the Client ID.
{% image src="/images/v1.10/deployment/security/okta/click-edit-token.png" alt="click-edit-token" /%}


After the applying these steps, you can update the configuration of your deployment:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/okta/docker" %}
    Configure OKTA SSO for your Docker Deployment.
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/okta/bare-metal" %}
    Configure OKTA SSO for your Bare Metal Deployment.
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Kubernetes Security"
    href="/deployment/security/okta/kubernetes" %}
    Configure OKTA SSO for your Kubernetes Deployment.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}


{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="MdArrowBack"
    bold="OKTA"
    href="/deployment/security/okta" %}
    Go to okta Configuration
  {% /inlineCallout %}
{% /inlineCalloutContainer %}