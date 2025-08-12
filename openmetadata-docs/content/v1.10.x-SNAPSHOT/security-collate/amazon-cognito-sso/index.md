---
title: Amazon Cognito SSO Setup | Secure Collate Access with AWS
description: Follow step-by-step instructions to integrate Amazon Cognito SSO with Collate. Configure user pools, client credentials, and callback URLs for secure login.
slug: /security/amazon-cognito
collate: true
---

# Amazon Cognito SSO

Follow the sections in this guide to set up Amazon Cognito SSO.

{% note %}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Amazon Cognito SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens) in case it is
  enabled.

{% /note %}

## Create Server Credentials

### Step 1: Login to AWS Portal

- Login to [Amazon AWS Portal](https://aws.amazon.com/).
- Search for `Cognito` in the search box and select Cognito Service from the dropdown menu.

{% image src="/images/v1.10/deployment/security/amazon-cognito-sso/create-server-credentials-1.png" alt="create-account" caption="Search for Cognito" /%}

### Step 2: Setup User Pool

- Click on the "Create user pool" button if you do not have any user pools configured yet. Skip this step if you already have a user pool available. 
- Select the type of ID providers you want to configure for your users and click "Next"

{% image src="/images/v1.10/deployment/security/amazon-cognito-sso/create-server-credentials-2.png" alt="create-account" caption="Setup User Pool" /%}

- Configure the security requirements in Step 2 as per your organizational needs and proceed to Step 3 
- Configure the Sign-up experience in Step 3. Make sure to add email as a required attribute before proceeding to step 4

{% image src="/images/v1.10/deployment/security/amazon-cognito-sso/create-server-credentials-3.png" alt="create-account" caption="Configure Sign up Experience" /%}

- Configure message delivery as per your organizational needs and proceed to Step 5
- In Step 5, add a name for the user pool and check the "Use the Cognito Hosted UI" option and provide a Cognito domain as shown in the screenshot below

{% image src="/images/v1.10/deployment/security/amazon-cognito-sso/create-server-credentials-4.png" alt="create-account" caption="Integrate your App" /%}

- In the same step, select "Public client" for the Initial App client type and configure the Allowed callback URLs
  with `https://{your-collate-domain}/callback` as shown in the screenshot below. Note: For production deployments, the Allowed
  callback URLs should be updated with the appropriate domain name.

{% image src="/images/v1.10/deployment/security/amazon-cognito-sso/create-server-credentials-5.png" alt="create-account" caption="Configure the App Client" /%}

- The last step is to Review and create the User Pool.

### Step 3: Where to find the Credentials

- The `User Pool ID` can be found in the User Pool summary page as seen in the screenshot below

{% image src="/images/v1.10/deployment/security/amazon-cognito-sso/create-server-credentials-6.png" alt="create-account" caption="User Pool ID" /%}

- The App client ID can be found under the "App Integration" tab of the User Pool page. There will be a section that
  lists all the App clients with client name and client ID as shown below

{% image src="/images/v1.10/deployment/security/amazon-cognito-sso/create-server-credentials-7.png" alt="create-account" /%}

{% image src="/images/v1.10/deployment/security/amazon-cognito-sso/create-server-credentials-8.png" alt="create-account" caption="Client ID" /%}

You will need to share the following information with the Collate team:
- Client ID
- User Pool ID
