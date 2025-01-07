---
title: SAML SSO for Kubernetes
slug: /deployment/security/saml/kubernetes
collate: false
---

# SAML SSO for Kubernetes

See the snippet below for an example of SAML configurations in the `values.yaml`.

The configuration below already uses the presets shown in the example of saml configurations, you can change to yours.

```yaml
openmetadata:
  config:
    idp:
      entityId: ${SAML_IDP_ENTITY_ID:-"https://mocksaml.com/api/saml/sso"}
      ssoLoginUrl: ${SAML_IDP_SSO_LOGIN_URL:-"https://saml.example.com/entityid"}
      idpX509Certificate: ${SAML_IDP_CERTIFICATE:-""}
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

{% partial file="/v1.7/deployment/configure-ingestion.md" /%}
