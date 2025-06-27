---
title: SAML AZURE SSO
slug: /security/saml/azure
collate: true
---

# SAML AZURE SSO

Follow the sections in this guide to set up Azure SSO using SAML.

{% note %}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens) in case it is enabled.

{% /note %}

## Create OpenMetadata application

### Step 1: Configure a new Application in Microsoft Entra ID

- Login to [Azure Portal](https://portal.azure.com) as an administrator and search for Microsoft Entra ID.

{% image src="/images/v1.9/deployment/security/saml/azure/saml-azure-1.png" alt="EnterpriseApplications" /%}

- Click on `Enterprise Applications` and then ` + New Application ` .

{% image src="/images/v1.9/deployment/security/saml/azure/saml-azure-2.png" alt="new-application" /%}

- After that a new window will appear with different applications, click on `Create your own application`.

{% image src="/images/v1.9/deployment/security/saml/azure/saml-azure-3.png" alt="create-own-application" /%}

- Give your application a name and select `Integrate any other application you don't find in the gallery` and then click `Create`.

{% image src="/images/v1.9/deployment/security/saml/azure/saml-azure-4.png" alt="name-application-create" /%}

- Once you have the application created, open the app from list , and then click on `Single Sign-On` and then `SAML`.

{% image src="/images/v1.9/deployment/security/saml/azure/saml-azure-5.png" alt="saml-create-single-sign-On" /%}

- Edit `Basic SAML Configuration` and populate the values as shown below for `EntityId` and `Assertion Consumer Service Url`. These value should match the one configured with Openmetadata Server side for `samlConfiguration.sp.entityId` and `samlConfiguration.sp.acs` respectively. After this click `Save`.

{% image src="/images/v1.9/deployment/security/saml/azure/saml-azure-6.png" alt="edit-basic-saml-configuration" /%}

- Click on `Attributes and Claims` and click on the `Required Claim (NameId)`.

{% image src="/images/v1.9/deployment/security/saml/azure/saml-azure-7.png" alt="edit-claims" /%}

- You will see the values as below image, we need to set the value `Source Attribute` to a user mail value claim from the IDP. Click on `Edit` and then select the `Source Attribute` as `user.mail` or `user.userprincipalname` (in some cases this is also a mail) and then click `Save`.

{% image src="/images/v1.9/deployment/security/saml/azure/saml-azure-8.png" alt="edit-claim-value" /%}

- To Confirm the claim value we can navigate to user page and check the value of the user. In my case as you can see User Princpal Name is a my mail which i want to use for Openmetadata , so for me `user.userprincipalname` would be correct claim.

{% image src="/images/v1.9/deployment/security/saml/azure/saml-azure-9.png" alt="user-claim-value" /%}

{% note %}

Security requirements for your **production** environment:
- You must always communicate via signed Request for both request from SP to IDP and response from IDP to SP.
- To do so we need to add SP certificate to IDP , so that IDP can validate the signed Auth Request coming from SP.

- Generate the certificate using below command and then upload the certificate to IDP. 
```shell
openssl req -new -x509 -days 365 -nodes -sha256 -out saml.crt -keyout saml.pem
openssl x509 -in saml.crt -out samlCER.cer -outform DER
```

- Under `Single Sign-On` you will see SAML Certificates, click on `Verification Certificates`.
 
{% image src="/images/v1.9/deployment/security/saml/azure/saml-azure-11.png" alt="verification-certificate" /%}

- You can then check the `Require Verification Certificates` and import the certification with .cer format we generated previously.

{% /note %}

Send the Collate team the above information to configure the server.
