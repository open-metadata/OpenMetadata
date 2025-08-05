---
title: samlSSOClientConfig | OpenMetadata SAML SSO Client
description: Configure SAML-based SSO client for secure authentication using identity provider settings including metadata URLs and entity IDs.
slug: /main-concepts/metadata-standard/schemas/security/client/samlssoclientconfig
---

# SamlSSOClientConfig

*SAML SSO client security configs.*

## Properties

- **`idp`**: Refer to *[#/definitions/idp](#definitions/idp)*.
- **`sp`**: Refer to *[#/definitions/sp](#definitions/sp)*.
- **`security`**: Refer to *[#/definitions/security](#definitions/security)*.
- **`debugMode`** *(boolean)*: Get logs from the Library in debug mode. Default: `false`.
## Definitions

- **`idp`** *(object)*: This schema defines defines the identity provider config. Cannot contain additional properties.
  - **`entityId`** *(string, required)*: Identity Provider Entity ID usually same as the SSO login URL.
  - **`ssoLoginUrl`** *(string, required)*: SSO Login URL.
  - **`idpX509Certificate`** *(string)*: X509 Certificate .
  - **`authorityUrl`** *(string)*: Authority URL to redirect the users on Sign In page.
  - **`nameId`** *(string)*: Authority URL to redirect the users on Sign In page. Default: `"urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress"`.
- **`sp`** *(object)*: This schema defines defines the identity provider config. Cannot contain additional properties.
  - **`entityId`** *(string, required)*: Service Provider Entity ID.
  - **`acs`** *(string, required)*: Assertion Consumer URL.
  - **`spX509Certificate`** *(string)*: X509 Certificate .
  - **`spPrivateKey`** *(string)*: Sp Private Key for Signing and Encryption Only.
  - **`callback`** *(string, required)*: Service Provider Entity ID usually same as the SSO login URL.
- **`security`** *(object)*: This schema defines defines the security config for SAML. Cannot contain additional properties.
  - **`strictMode`** *(boolean)*: Only accept valid signed and encrypted assertions if the relevant flags are set. Default: `false`.
  - **`validateXml`** *(boolean)*: In case of strict mode whether to validate XML format. Default: `false`.
  - **`tokenValidity`** *(integer)*: Validity for the JWT Token created from SAML Response. Default: `"3600"`.
  - **`sendEncryptedNameId`** *(boolean)*: Encrypt Name Id while sending requests from SP. Default: `false`.
  - **`sendSignedAuthRequest`** *(boolean)*: Sign the Authn Request while sending. Default: `false`.
  - **`signSpMetadata`** *(boolean)*: Want the Metadata of this SP to be signed. Default: `false`.
  - **`wantMessagesSigned`** *(boolean)*: SP requires the messages received to be signed. Default: `false`.
  - **`wantAssertionsSigned`** *(boolean)*: SP requires the assertions received to be signed. Default: `false`.
  - **`wantAssertionEncrypted`** *(boolean)*: SP requires the assertion received to be encrypted. Default: `false`.
  - **`keyStoreFilePath`** *(string)*: KeyStore File Path.
  - **`keyStoreAlias`** *(string)*: KeyStore Alias.
  - **`keyStorePassword`** *(string)*: KeyStore Password.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
