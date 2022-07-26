---
title: Okta SSO
slug: /deployment/security/okta
---

# Okta SSO

Follow the sections in this guide to set up Okta SSO.

<Collapse title="Create Server Credentials">
This document will explain how to create an Okta app and configure it for OAuth. This will generate the information required for Single Sign On with Okta.

### Step 1: Create an Okta Account
- Go to [Create Okta Account](https://developer.okta.com/signup/).
- Provide the required input and click on Sign Up.
- Else you can continue with Google or GitHub.

### Step 2: Create the OIDC App Integration.
- Once done with **Signup/Sign** in, you will be redirected to the **Getting Started** page in Okta.
<Image src="/images/deployment/security/okta/create-oidc-app-integration.png" alt="create-oidc-app-integration"/>

- Click on **Applications -> Applications** in the left navigation panel.
<Image src="/images/deployment/security/okta/click-applications.png" alt="click-applications"/>

- Click on the **Create App Integration** button.
<Image src="/images/deployment/security/okta/create-app-integration.png" alt="create-app-integration"/>

### Step 3: Configuring the App
- Once you are in the **Create a new app integration** page, select **OIDC - OpenID Connect**.
- Next, select the **Application type -> Single-Page Application**.
- Once selected, click **Next**.
<Image src="/images/deployment/security/okta/configuring-the-app.png" alt="configuring-the-app"/>

- From the **General Settings** page,
  * Enter an **App integration name**
  * Select the following in **Grant type**:
    * **Authorization Code**
    * **Refresh Token** - For the refresh token behavior, it is recommended to select the option to 'Rotate token after every use'.
    * **Implicit (hybrid)** - Select the options to allow ID Token and Access Token with implicit grant type.
  * Enter the **Sign-in redirect URIs**
    * http://localhost:8585/signin
    * http://localhost:8585
  * Enter the **Sign-out redirect URIs**
  * Enter the **Base URIs**
  * Select the required option for **Controlled access**
- Click **Save**.
<Image src="/images/deployment/security/okta/general-settings-click-save.png" alt="general-settings-click-save"/>

- The app is now configured.
<Image src="/images/deployment/security/okta/app-is-configured.png" alt="app-is-configured"/>

### Step 4: Add Authorization Server to get the Issuer URL
It is recommended to create a separate authorization server for different applications. The authorization server needs an endpoint, which'll be the Issuer URL.
- Click on **Security -> API** in the left navigation panel.
<Image src="/images/deployment/security/okta/click-security-api.png" alt="click-security-api"/>

- From the **Authorization Servers** tab, click on **Add Authorization Server** button.
<Image src="/images/deployment/security/okta/click-add-authorization-server.png" alt="click-add-authorization-server"/>

- Enter a Name and Description.
- While creating the authorization server, an **Audience** must be provided for the server. The Audience is the **Client ID** of the single page application that was created. Refer the next Step 7 to locate the Client ID.
- **Save** the changes.
<Image src="/images/deployment/security/okta/add-auth-server-save-changes.png" alt="add-auth-server-save-changes"/>

This will generate the Issuer URL.

### Step 5: Change the Issuer URL from Dynamic to Okta URL
Once the Authorization Server has been added, navigate to Security >> API >> Authorization Servers and click on the authorization server created in the previous step.
<Image src="/images/deployment/security/okta/click-auth-server-from-prev-step.png" alt="click-auth-server-from-prev-step"/>

The Issuer URL shows up as Dynamic by default. Change the Issuer URL to Okta URL and save the changes.
<Image src="/images/deployment/security/okta/change-issuer-url.png" alt="change-issuer-url"/>

### Step 6: Create a Default Scope
- To create a default scope from **Security -> API**, click on the required **Authorization Server**.
<Image src="/images/deployment/security/okta/click-req-auth-server.png" alt="click-req-auth-server"/>

- In the resulting page, click on the **Scopes** tab
- Click on **Add Scope**
<Image src="/images/deployment/security/okta/add-scope.png" alt="add-scope"/>

- Set as a **Default Scope**.
<Image src="/images/deployment/security/okta/set-default-scope.png" alt="set-default-scope"/>

## Step 7: Add New Access Policy and Rule
- From **Security -> API**, click on the required **Authorization Server**
- Navigate to the **Access Policies Tab**
- Click on **Add New Access Policy**
<Image src="/images/deployment/security/okta/add-new-access-policy.png" alt="add-new-access-policy"/>

- To create a policy, add a Name and Description.
- Assign the policy to the required clients.
<Image src="/images/deployment/security/okta/assign-policy.png" alt=""/>

- Add a new **Rule** inside the policy as required. Rules can be created with just a few grant type details, such as Client Credentials, Authorization Code, Device Authorization, and Token Exchange.
- Click on **Create Rule** to save the changes.
<Image src="/images/deployment/security/okta/add-rule.png" alt="add-rule"/>

### Step 8: Where to Find the Credentials
- Once the app is configured, the **Client ID** can be used.
- You can also go to **Application -> Application** as in step 2.
- You should be able to see your application in the list.
<Image src="/images/deployment/security/okta/see-your-application.png" alt="see-your-application"/>

- Click on your application.
- You will find your **Client ID** and **Okta domain**.
- The **Client authentication** is enabled by default.
- By clicking on the Edit **** option for General Settings, you can deselect the option for **User consent**. Save the changes.
<Image src="/images/deployment/security/okta/deselect-user-consent.png" alt="deselect-user-consent"/>

- Click on the **Sign On** tab from the top navigation bar.
- Click on Edit for **OpenID Connect ID Token**.
- For **Issuer**, change from the Dynamic (based on request domain) option to the **Okta URL** option.
- The **Audience** is the same as the Client ID.
<Image src="/images/deployment/security/okta/click-edit-token.png" alt="click-edit-token"/>

</Collapse>

<Collapse title="Create Service Application">
This is a guide to create ingestion bot service app.

### Step 1: Generate Public/Private Key Pair
#### For a Test or Staging Instance:
- Use a tool such as this JSON [Web Key Generator](https://mkjwk.org/) to generate a JWKS public/private key pair for testing.

#### For a Production Instance:
- Use your own [internal instance](https://github.com/mitreid-connect/mkjwk.org) of the key pair generator.
- Clone the repository using `git clone https://github.com/mitreid-connect/mkjwk.org.git`.
- Use `mvn package -DskipTests && java -jar target/ROOT.war` to run the above repo.
- Go to `http:localhost:8080` to generate **public/private key** pairs.
<Image src="/images/deployment/security/okta/generate-keys.png" alt="generate-keys"/>

- Enter the following values to generate a **public/private key pair**:
  * Key size - 2048
  * Key use — signature
  * Algorithm — RSA256
  * Key ID — Enter the Key ID that is fetched from the issuer_url/v1/keys. Fetch the kid as the key ID

<Image src="/images/deployment/security/okta/see-key-ids.png" alt="see-key-ids"/>
<Image src="/images/deployment/security/okta/enter-key-ids-from-issuer.png" alt="enter-key-ids-from-issuer"/>

- Once you provide the input, click **Generate**. You will get the **Public/Private Keypair**, **Public/Private Keypair Set**, and **Public Key**
<Image src="/images/deployment/security/okta/get-keys.png" alt="get-keys"/>

### Step 2: Create a Token
While creating the service application, an authorization token will be needed. To create a token:
- Navigate to **Security -> API** from the left nav bar.
- Click on the **Tokens** tab.
- Click on **Create New Token**
- Save the token safely.

### Step 3: Create Service Application
- You will need to make a **POST** request to `https://${yourOktaDomain}/oauth2/v1/clients` endpoint to create a service app in okta
- The parameters involved in the request are:
  * **client_name** - the name of the service app
  * **grant_type - client_credentials**
  * **token_endpoint_auth_method — private_key_jwt**
  * **application_type — service**
  * **jwks** — add the **Public/Private Keypair** Set that you created in the previous step.
- Create a service app using the below format:

```
curl --location --request POST '<domain-url>/oauth2/v1/clients' \
--header 'Authorization: SSWS <token-created-in-previous-step>' \
--header 'Content-Type: application/json' \
--data-raw '{
    "client_name": "OM-service-app-postman-4",
    "grant_types": [
        "client_credentials"
    ],
    "response_types": [
        "token"
    ],
    "token_endpoint_auth_method": "private_key_jwt",
    "application_type": "service",
    "jwks": {
        <public private key pair set with kid(key id) that of the authorization server>
}' 
```

- To check if the service app is created navigate to your **Okta Dashboard**.
- Click on **Applications -> Applications** in the left navigation bar.
- You should see your service account in the list.
<Image src="/images/deployment/security/okta/view-service-account.png" alt="view-service-account"/>

### Step 4: Grant Allowed Scopes
- To add scopes, navigate to your **Okta Dashboard**. Click on **Applications -> Applications** as in step 2.
- Click on your service app.
<Image src="/images/deployment/security/okta/select-the-service-app.png" alt="select-the-service-app"/>

- Now click on **Okta API Scopes** from the top nav bar.
- Grant the scopes by clicking on **Grant**. Ensure that the following scopes are granted:
  * okta.users.read
  * okta.users.manage
  * okta.clients.read
<Image src="/images/deployment/security/okta/ensure-scopes-are-granted.png" alt="ensure-scopes-are-granted"/>

- To get more information on the Scopes. Visit the [Doc](https://developer.okta.com/docs/guides/implement-oauth-for-okta/scopes/).

</Collapse>

After the applying these steps, you can update the configuration of your deployment:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/okta/docker"
  >
    Configure Auth0 SSO for your Docker Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/okta/bare-metal"
  >
    Configure Auth0 SSO for your Bare Metal Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Kubernetes Security"
    href="/deployment/security/okta/kubernetes"
  >
    Configure Auth0 SSO for your Kubernetes Deployment.
  </InlineCallout>
</InlineCalloutContainer>

## Configure Ingestion

After everything has been set up, you will need to configure your workflows if you are running them via the
`metadata` CLI or with any custom scheduler.

When setting up the YAML config for the connector, update the `workflowConfig` as follows:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: okta
    securityConfig:
      clientId: "{CLIENT_ID - SPA APP}"
      orgURL: "{ISSUER_URL}/v1/token"
      privateKey: "{public/private keypair}"
      email: "{email}"
      scopes:
      - token
```
