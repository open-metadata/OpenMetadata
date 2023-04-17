---
title: SAML SSO
slug: /deployment/security/saml
---

# SAML SSO

<Important>

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens) in case it is enabled.

</Important>

Follow this sections in this guide to set up Saml for almost any IDP. In Openmetadata the SAML configuration
are divided into the following three sections:-

- Identity Provide (IDP) Configuration

```yaml
    idp:
      entityId: ${SAML_IDP_ENTITY_ID:-"https://mocksaml.com/api/saml/sso"}
      ssoLoginUrl: ${SAML_IDP_SSO_LOGIN_URL:-"https://saml.example.com/entityid"}
      idpX509Certificate: ${SAML_IDP_CERTIFICATE:-""}
      authorityUrl: ${SAML_AUTHORITY_URL:-"http://localhost:8585/api/v1/saml/login"}
      nameId: ${SAML_IDP_NAME_ID:-"urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"}
```

- Service Provider (SP) Configuration (SP is Openmetadata)

```yaml
  sp:
  entityId: ${SAML_SP_ENTITY_ID:-"http://localhost:8585/api/v1/saml/metadata"}
  acs: ${SAML_SP_ACS:-"http://localhost:8585/api/v1/saml/acs"}
  spX509Certificate: ${SAML_SP_CERTIFICATE:-""}
  callback: ${SAML_SP_CALLBACK:-"http://localhost:8585/saml/callback"}
  
```
- Security Config

```yaml
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

## Configuring Identity Provider and Service Provider

### Identity Provide (IDP) Configuration

- Every IDP will have the following information

1. EntityId/Authority -> Same as IDP Openmetadata has an Entity Id
2. SignOn Url -> Service Provider SignOn Url
3. X509 Certificate -> In case the SP expects (wantAuthnRequestSigned) then provide certificate for validating.
4. Authority Url -> We just need to update the domain `localhost`.
5. NameID: This is sent as part of request and is provided by the IDP.

Every IDP provides this information, we can download the XML Metadata and configure the OM taking the values from the XML.

### Service Provider (SP) Configuration

- Openmetadata is the service provider, we just update the `localhost` to the hosted URI.

1. EntityId/Authority -> Normally a Url providing info about the provider.
2. SignOn Url -> Url to be used for signing purpose.
3. X509 Certificate -> In case the SP expects a signed reponse from IDP, the IDP can be configured with Signing Certificate given by SP.
4. Private Key -> In case SP expects a encrypted response from the IDP , the IDP can be  configured with SPs public key for encryption and the Private Key can be used for SP for decrypting.

SP Metadata XML is available at "http://localhost:8585/api/v1/saml/metadata", `localhost` needs to be updated with the correct URI.

### Security Configuration

Security Configuration controls the SP requirement for the Security related aspects.
The SP can be configured to send signed or encrypted or both request , and in return can also expect 
signed or encrypted or both responses from the IDP.

## Setup JWT Configuration

Jwt Configuration is mandatory for Saml SSO.

- Follow the guide here for JWT Configuration [Enable JWT Token](https://docs.open-metadata.org/deployment/security/enable-jwt-tokens).

<Important>

Security requirements for your **production** environment:
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens) the ones shipped with OM are for POC only.

</Important>

More specific details on different IDPs can be found below:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="celebration"
    bold="AWS Saml"
    href="/deployment/security/saml/aws"
  >
    Configure AWS as IDP.
  </InlineCallout>
</InlineCalloutContainer>