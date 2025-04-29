---
title: SAML AZURE SSO
slug: /deployment/security/saml/azure
collate: false
---

# SAML AZURE SSO

Follow the sections in this guide to set up Azure SSO using SAML.

{% note %}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens) in case it is enabled.

{% /note %}

{% note %}

## Key Notes on SAML Configuration

1. **Set `AUTHENTICATION_PROVIDER` to `saml` (lowercase):**  
   Ensure the `AUTHENTICATION_PROVIDER` field in your environment variables is explicitly set to `saml` for SAML authentication to function correctly. Without this, SAML integration will not work.

2. **Routing to IDP:**  
   Users will only be routed to the IDP upon sign-in if `AUTHENTICATION_PROVIDER` is set to `saml`.

{% /note %}

## Create OpenMetadata application

### Step 1: Configure a new Application in Microsoft Entra ID

- Login to [Azure Portal](https://portal.azure.com) as an administrator and search for Microsoft Entra ID.

{% image src="/images/v1.7/deployment/security/saml/azure/saml-azure-1.png" alt="EnterpriseApplications" /%}

- Click on `Enterprise Applications` and then ` + New Application ` .

{% image src="/images/v1.7/deployment/security/saml/azure/saml-azure-2.png" alt="new-application" /%}

- After that a new window will appear with different applications, click on `Create your own application`.

{% image src="/images/v1.7/deployment/security/saml/azure/saml-azure-3.png" alt="create-own-application" /%}

- Give your application a name and select `Integrate any other application you don't find in the gallery` and then click `Create`.

{% image src="/images/v1.7/deployment/security/saml/azure/saml-azure-4.png" alt="name-application-create" /%}

- Once you have the application created, open the app from list , and then click on `Single Sign-On` and then `SAML`.

{% image src="/images/v1.7/deployment/security/saml/azure/saml-azure-5.png" alt="saml-create-single-sign-On" /%}

- Edit `Basic SAML Configuration` and populate the values as shown below for `EntityId` and `Assertion Consumer Service Url`. These value should match the one configured with Openmetadata Server side for `samlConfiguration.sp.entityId` and `samlConfiguration.sp.acs` respectively. After this click `Save`.

{% image src="/images/v1.7/deployment/security/saml/azure/saml-azure-6.png" alt="edit-basic-saml-configuration" /%}

- Click on `Attributes and Claims` and click on the `Required Claim (NameId)`.

{% image src="/images/v1.7/deployment/security/saml/azure/saml-azure-7.png" alt="edit-claims" /%}

- You will see the values as below image, we need to set the value `Source Attribute` to a user mail value claim from the IDP. Click on `Edit` and then select the `Source Attribute` as `user.mail` or `user.userprincipalname` (in some cases this is also a mail) and then click `Save`.

{% image src="/images/v1.7/deployment/security/saml/azure/saml-azure-8.png" alt="edit-claim-value" /%}

- To Confirm the claim value we can navigate to user page and check the value of the user. In my case as you can see User Princpal Name is a my mail which i want to use for Openmetadata , so for me `user.userprincipalname` would be correct claim.

{% image src="/images/v1.7/deployment/security/saml/azure/saml-azure-9.png" alt="user-claim-value" /%}

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
 
{% image src="/images/v1.7/deployment/security/saml/azure/saml-azure-11.png" alt="verification-certificate" /%}

- You can then check the `Require Verification Certificates` and import the certification with .cer format we generated previously.

{% /note %}

### Step 2: Setup `OpenMetadata Server` 

- Open the downloaded metadata xml file, and populate the following properties in `openmetadata.yml`
```yaml
  authenticationConfiguration:
     provider: ${AUTHENTICATION_PROVIDER:-saml}
  samlConfiguration:
    debugMode: ${SAML_DEBUG_MODE:-false}
    idp:
      entityId: ${SAML_IDP_ENTITY_ID:-"https://mocksaml.com/api/saml/sso"}
      ssoLoginUrl: ${SAML_IDP_SSO_LOGIN_URL:-"https://saml.example.com/entityid"}
      idpX509Certificate: ${SAML_IDP_CERTIFICATE:-""} #Pass the certificate as a string
      authorityUrl: ${SAML_AUTHORITY_URL:-"http://localhost:8585/api/v1/saml/login"}
      nameId: ${SAML_IDP_NAME_ID:-"urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"}
    sp:
      entityId: ${SAML_SP_ENTITY_ID:-"http://localhost:8585/api/v1/saml/acs"}
      acs: ${SAML_SP_ACS:-"http://localhost:8585/api/v1/saml/acs"}
      spX509Certificate: ${SAML_SP_CERTIFICATE:-""}
      callback: ${SAML_SP_CALLBACK:-"http://localhost:8585/saml/callback"}
    security:
      strictMode: ${SAML_STRICT_MODE:-false}
      tokenValidity: ${SAML_SP_TOKEN_VALIDITY:-"3600"}
      sendEncryptedNameId: ${SAML_SEND_ENCRYPTED_NAME_ID:-false}
      sendSignedAuthRequest: ${SAML_SEND_SIGNED_AUTH_REQUEST:-false}
      signSpMetadata: ${SAML_SIGNED_SP_METADATA:-false}
      wantMessagesSigned: ${SAML_WANT_MESSAGE_SIGNED:-false}
      wantAssertionsSigned: ${SAML_WANT_ASSERTION_SIGNED:-false}
      wantAssertionEncrypted: ${SAML_WANT_ASSERTION_ENCRYPTED:-false}
      wantNameIdEncrypted: ${SAML_WANT_NAME_ID_ENCRYPTED:-false}
      keyStoreFilePath: ${SAML_KEYSTORE_FILE_PATH:-""}
      keyStoreAlias: ${SAML_KEYSTORE_ALIAS:-""}
      keyStorePassword: ${SAML_KEYSTORE_PASSWORD:-""}
```

- Populate the above config from [xml metadata](/deployment/security/saml/xml_file)

 {% image src="/images/v1.7/deployment/security/saml/aws/saml-aws-8.png" alt="populate-metadata" /%}

- IDP Config         
    `entityID` -> Populate it from Metadata XML Entity ID
    `HTTP-Redirect SSO Login URL` -> always select HTTP-Redirect Url for SSO Login Url
    `X509 Certificate` -> This is also available in the IDP XML.
    `NameIDFormat` -> from MetadataXML NameIDFormat
    `authorityUrl` -> set as {http}/{https}://{domain}:{port}/api/v1/saml/login

- SP Config
  `entityId` -> -> set as {http}/{https}://{domain}:{port}/api/v1/saml/acs
  `acs` -> Assertion Consumer Url , set as {http}/{https}://{domain}:{port}/api/v1/saml/acs
  `spX509Certificate` -> set to your X509 Signing Key
  `callback` -> set as {http}/{https}://{domain}/api/v1/saml/callback

{% note %}

- Security Parameters can be configured in case we want to have signed or encrypted or both assertions.
  In any case we decided to use above config for security then it is mandatory to provide keystore config,
  from where the system can load the signing certificate or Private Key for encryption.  
- For **production** environment , it is always suggested to keep these true
```yaml
      sendSignedAuthRequest: ${SAML_SEND_SIGNED_AUTH_REQUEST:-true}
      wantMessagesSigned: ${SAML_WANT_MESSAGE_SIGNED:-true}
      wantAssertionsSigned: ${SAML_WANT_ASSERTION_SIGNED:-true}
```

{% /note %}

### Step 3: Setup JWT Configuration

- Follow the guide here for JWT Configuration [Enable JWT Token](/deployment/security/enable-jwt-tokens).

{% note %}

Security requirements for your **production** environment:
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens) the ones shipped with OM are for POC only.

{% /note %}

### Step 4: Start the server

- Start the OpenMetadata server. With `AUTHENTICATION_PROVIDER` set to saml, you should be routed to the IDP upon sign-in.
