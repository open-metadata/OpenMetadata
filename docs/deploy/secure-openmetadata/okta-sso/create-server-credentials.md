---
description: >-
  This document will explain how to create an Okta app and configure it for
  OAuth. This will generate the information required for Single Sign On with
  Okta.
---

# Create Server Credentials

## Step 1: Create an Okta Account

* Go to [Create Okta Account](https://developer.okta.com/signup/).
* Provide the required input and click on **Sign Up**.
* Else you can **continue with Google or GitHub**.

## Step 2: Create the OIDC App Integration.

* Once done with **Signup/Sign in**, you will be redirected to the **Getting Started** page in Okta.

![](<../../../.gitbook/assets/image (56) (1).png>)

* Click on **Applications -> Applications** in the left navigation panel.

![](<../../../.gitbook/assets/image (10) (1).png>)

* Click on the **Create App Integration** button.

![](<../../../.gitbook/assets/image (42) (1) (1).png>)

## Step 3: Configuring the App

* Once you are in the **Create a new app integration** page, select **OIDC - OpenID Connect**.
* Next, select the **Application type -> Single-Page Application**.
* Once selected, click **Next**.

![](<../../../.gitbook/assets/image (41) (1).png>)

* From the **General Settings** page,
  * Enter an **App integration name**
  * Select the following in **Grant type**:
    * **Authorization Code**
    * **Refresh Token** - For the refresh token behavior, it is recommended to select the option to 'Rotate token after every use'.
    * **Implicit (hybrid)** - Select the options to allow ID Token and Access Token with implicit grant type.
  * Enter the **Sign-in redirect URIs**
    * [http://localhost:8585/signin\
      http://localhost:8585](http://localhost:8585/signinhttp://localhost:8585)
  * Enter the **Sign-out redirect URIs**
  * Enter the **Base URIs**
  * Select the required option for **Controlled access**
* Click **Save**.

![](<../../../.gitbook/assets/image (20) (1) (1) (1) (1).png>)

* The app is now configured.

![](<../../../.gitbook/assets/image (28) (1).png>)

## Step 4: Add Authorization Server to get the Issuer URL

It is recommended to create a separate authorization server for different applications. The authorization server needs an endpoint, which'll be the Issuer URL.

* Click on **Security -> API** in the left navigation panel.

![](<../../../.gitbook/assets/image (17) (1).png>)

* From the **Authorization Servers** tab, click on **Add Authorization Server** button.

![](<../../../.gitbook/assets/image (29) (1) (1).png>)

* Enter a Name and Description.
* While creating the authorization server, an **Audience** must be provided for the server. The Audience is the **Client ID** of the single page application that was created. Refer the next [Step 7](create-server-credentials.md#step-7-where-to-find-the-credentials) to locate the Client ID.
* **Save** the changes.

![](<../../../.gitbook/assets/image (32) (1).png>)

This will generate the Issuer URL.

## Step 5: Create a Default Scope

* To create a default scope from **Security -> API**, click on the required **Authorization Server**.

![](<../../../.gitbook/assets/image (71).png>)

* In the resulting page, click on the **Scopes** tab
* Click on **Add Scope**

![](<../../../.gitbook/assets/image (51) (1).png>)

* Set as a **Default Scope**.

![](<../../../.gitbook/assets/image (73).png>)

## Step 6: Add New Access Policy and Rule

* From **Security -> API**, click on the required **Authorization Server**
* Navigate to the **Access Policies Tab**
* Click on **Add New Access Policy**

![](<../../../.gitbook/assets/image (37) (1).png>)

* To create a policy, add a Name and Description.
* Assign the policy to the required clients.

![](<../../../.gitbook/assets/image (2) (1) (1) (1) (1).png>)

* Add a new **Rule** inside the policy as required. Rules can be created with just a few grant type details, such as Client Credentials, Authorization Code, Device Authorization, and Token Exchange.
* Click on **Create Rule** to save the changes.

![](<../../../.gitbook/assets/image (40) (1).png>)

## Step 7: Where to Find the Credentials

* Once the app is configured, the **Client ID** can be used.
* You can also go to **Application -> Application** as in step 2.
* You should be able to see your application in the list.

![](<../../../.gitbook/assets/image (59) (1) (1).png>)

* Click on your application.
* You will find your **Client ID** and **Okta domain**.
* The **Client authentication** is enabled by default.
* By clicking on the Edit \*\*\*\* option for General Settings, you can deselect the option for **User consent**. Save the changes.

![](<../../../.gitbook/assets/image (1) (1) (1) (1).png>)

* Click on the **Sign On** tab from the top navigation bar.
* Click on Edit for **OpenID Connect ID Token**.
* For **Issuer**, change from the Dynamic (based on request domain) option to the **Okta URL** option.
* The **Audience** is the same as the Client ID.

![](<../../../.gitbook/assets/image (5) (1) (1) (1).png>)
