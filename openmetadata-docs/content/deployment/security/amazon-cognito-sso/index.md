---
title: Amazon Cognito SSO
slug: /deployment/security/amazon-cognito
---

# Amazon Cognito SSO

Follow the sections in this guide to set up Amazon Cognito SSO.

## Create Server Credentials

### Step 1: Login to AWS Portal

- Login to [Amazon AWS Portal](https://aws.amazon.com/).
- Search for `Cognito` in the search box and select Cognito Service from the dropdown menu.

<Image src="/images/deployment/security/amazon-cognito-sso/create-server-credentials-1.png" alt="create-account" caption="Search for Cognito"/>

### Step 2: Setup User Pool

- Click on the "Create user pool" button if you do not have any user pools configured yet. Skip this step if you already have a user pool available. 
- Select the type of ID providers you want to configure for your users and click "Next"

<Image src="/images/deployment/security/amazon-cognito-sso/create-server-credentials-2.png" alt="create-account" caption="Setup User Pool"/>

- Configure the security requirements in Step 2 as per your organizational needs and proceed to Step 3 
- Configure the Sign-up experience in Step 3. Make sure to add email as a required attribute before proceeding to step 4

<Image src="/images/deployment/security/amazon-cognito-sso/create-server-credentials-3.png" alt="create-account" caption="Configure Sign up Experience"/>

- Configure message delivery as per your organizational needs and proceed to Step 5
- In Step 5, add a name for the user pool and check the "Use the Cognito Hosted UI" option and provide a Cognito domain as shown in the screenshot below

<Image src="/images/deployment/security/amazon-cognito-sso/create-server-credentials-4.png" alt="create-account" caption="Integrate your App"/>

- In the same step, select "Public client" for the Initial App client type and configure the Allowed callback URLs
  with `http://localhost:8585/callback` as shown in the screenshot below. Note: For production deployments, the Allowed
  callback URLs should be updated with the appropriate domain name.

<Image src="/images/deployment/security/amazon-cognito-sso/create-server-credentials-5.png" alt="create-account" caption="Configure the App Client"/>

- The last step is to Review and create the User Pool.

### Step 3: Where to find the Credentials

- The `User Pool ID` can be found in the User Pool summary page as seen in the screenshot below

<Image src="/images/deployment/security/amazon-cognito-sso/create-server-credentials-6.png" alt="create-account" caption="User Pool ID"/>

- The App client ID can be found under the "App Integration" tab of the User Pool page. There will be a section that
  lists all the App clients with client name and client ID as shown below

<Image src="/images/deployment/security/amazon-cognito-sso/create-server-credentials-7.png" alt="create-account"/>

<Image src="/images/deployment/security/amazon-cognito-sso/create-server-credentials-8.png" alt="create-account" caption="Client ID"/>

After the applying these steps, you can update the configuration of your deployment:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/amazon-cognito/docker"
  >
    Configure Amazon Cognito SSO for your Docker Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/amazon-cognito/bare-metal"
  >
    Configure Amazon Cognito SSO for your Bare Metal Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Kubernetes Security"
    href="/deployment/security/amazon-cognito/kubernetes"
  >
    Configure Amazon Cognito SSO for your Kubernetes Deployment.
  </InlineCallout>
</InlineCalloutContainer>

## Configure Ingestion

The ingestion can be configured by [Enabling JWT Tokens](/deployment/security/enable-jwt-tokens).

<Important>

<h4> Security Note </h4>

<br/>

For **production** environment, please:
- **DELETE** de admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth) 
enabled before configuring the authentication with Amazon Cognito SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens) in case it is
enabled.

</Important>