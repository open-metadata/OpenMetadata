---
title: SAML AWS SSO
slug: /deployment/security/saml/aws
---

# SAML AWS SSO

Follow the sections in this guide to set up AWS SSO using SAML.

<Important>

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens) in case it is enabled.

</Important>

## Create OpenMetadata application

### Step 1: Configure a new Application in AWS Console

- Login to [AWS Console](https://aws.amazon.com/console/) as an administrator and search for IAM Identity Center.

<Image src="/images/deployment/security/saml/aws/saml-aws-1.png" alt="IAM-Identity-Center"/>

- Click on `Choose your identity source` and configure as per security requirements.

<Image src="/images/deployment/security/saml/aws/saml-aws-2.png" alt="identity-source"/>

- After identity source is set up successfully, goto step 2 and click on `Manage Access to application` and add all the required users who need access to application.

<Image src="/images/deployment/security/saml/aws/saml-aws-3.png" alt="manage-access"/>

- Click on `Set up Identity Center enabled applications`, and click  `Add application`, and select `Add custom SAML 2.0 application`.

<Image src="/images/deployment/security/saml/aws/saml-aws-4.png" alt="saml-application"/>

- Set Display Name to `OpenMetadata` , and download the metadata xml file and save it someplace safe, it is needed to setup OM Server

<Image src="/images/deployment/security/saml/aws/saml-aws-5.png" alt="metadata-xml"/>

- Click on `Manage assignments to your cloud applications` and select `OpenMetadata` from list of applications.

- Click on `Actions` and select `Edit Configurations` from list. Populate the shown values replacing  `localhost:8585` with your `{domain}:{port}` and Submit.

<Image src="/images/deployment/security/saml/aws/saml-aws-6.png" alt="edit-configuration"/>

- Click on `Actions` again and select `Edit Attribute Mapping` from list. Populate the values as shown below and submit

<Image src="/images/deployment/security/saml/aws/saml-aws-7.png" alt="edit-attribute"/>


### Step 2: Setup `OpenMetadata Server` 

- Open the downloaded metadata xml file, and populate the following properties in `openmetadata.yml`
```yaml
  samlConfiguration:
    debugMode: ${SAML_DEBUG_MODE:-false}
    idp:
      entityId: ${SAML_IDP_ENTITY_ID:-"https://mocksaml.com/api/saml/sso"}
      ssoLoginUrl: ${SAML_IDP_SSO_LOGIN_URL:-"https://saml.example.com/entityid"}
      idpX509Certificate: ${SAML_IDP_CERTIFICATE:-""}
      authorityUrl: ${SAML_AUTHORITY_URL:-"http://localhost:8585/api/v1/saml/login"}
      nameId: ${SAML_IDP_NAME_ID:-"urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"}
    sp:
      entityId: ${SAML_SP_ENTITY_ID:-"http://localhost:8585/api/v1/saml/metadata"}
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

- Populate the above config from xml metadata

<Image src="/images/deployment/security/saml/aws/saml-aws-8.png" alt="populate-metadata"/>

- IDP Config         
    `entityID` -> Populate it from Metadata XML Entity ID
    `HTTP-Redirect SSO Login URL` -> always select HTTP-Redirect Url for SSO Login Url
    `X509 Certificate` -> This is also available in the IDP XML.
    `NameIDFormat` -> from MetadataXML NameIDFormat
    `authorityUrl` -> set as {http}/{https}://{domain}:{port}/api/v1/saml/login

- SP Config
  `entityId` -> -> set as {http}/{https}://{domain}:{port}/api/v1/saml/metadata
  `acs` -> Assertion Consumer Url , set as {http}/{https}://{domain}:{port}/api/v1/saml/acs
  `spX509Certificate` -> set to your X509 Signing Key
  `callback` -> set as {http}/{https}://{domain}/api/v1/saml/callback

- Security Parameters can be configured in case we want to have signed or encrypted or both assertions.
  In any case we decided to use above config for security then it is mandatory to provide keystore config,
  from where the system can load the signing certificate or Private Key for encryption.  

### Step 3: Setup JWT Configuration

- Follow the guide here for JWT Configuration [Enable JWT Token](https://docs.open-metadata.org/deployment/security/enable-jwt-tokens).

<Important>

Security requirements for your **production** environment:
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens) the ones shipped with OM are for POC only.

</Important>

### Step 4: Start the server

- Set up for SAML is done, you should be routed to your IDP on trying to Sign-in.