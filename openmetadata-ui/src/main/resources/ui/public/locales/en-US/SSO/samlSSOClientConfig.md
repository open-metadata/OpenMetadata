---
title: SAML SSO Configuration | OpenMetadata
description: Configure SAML Single Sign-On for OpenMetadata with complete field reference
slug: /main-concepts/metadata-standard/schemas/security/client/saml-sso
---

SAML (Security Assertion Markup Language) SSO enables users to log in using SAML Identity Providers like Active Directory Federation Services (ADFS), Shibboleth, or other enterprise identity providers.

## <span data-id="clientId">Client ID</span>

- **Definition:** Client identifier for the SAML authentication configuration.
- **Example:** saml-client-123
- **Why it matters:** Used to identify this specific SAML configuration.
- **Note:** Optional for SAML, mainly used for tracking and configuration management

## <span data-id="callbackUrl">Callback URL</span>

- **Definition:** URL where users are redirected after SAML authentication (same as ACS URL).
- **Example:** https://yourapp.company.com/api/v1/saml/acs
- **Why it matters:** Defines where users land after successful SAML authentication.
- **Note:** Should match the Assertion Consumer Service URL

## <span data-id="authority">Authority</span>

- **Definition:** Authentication authority URL for the SAML provider.
- **Example:** https://yourapp.company.com/auth/saml
- **Why it matters:** Specifies the authentication endpoint for SAML.
- **Note:** Used by the authentication system to route SAML requests

## <span data-id="enableSelfSignup">Enable Self Signup</span>

- **Definition:** Allows users to automatically create accounts on first SAML login.
- **Options:** Enabled | Disabled
- **Example:** Enabled
- **Why it matters:** Controls whether new SAML users can join automatically or need manual approval.
- **Note:** Disable for stricter control over user access

## Identity Provider (IdP) Configuration

### <span data-id="entityId">IdP Entity ID</span>

- **Definition:** Unique identifier for the Identity Provider, usually the same as SSO login URL.
- **Example:** https://adfs.company.com/adfs/services/trust
- **Why it matters:** SAML messages use this to identify the IdP.
- **Note:** Must match exactly what's configured in your IdP

### <span data-id="ssoLoginUrl">SSO Login URL</span>

- **Definition:** URL where users are redirected to authenticate with the IdP.
- **Example:** https://adfs.company.com/adfs/ls/
- **Why it matters:** This is where authentication requests are sent.
- **Note:** Usually provided by your IdP administrator

### <span data-id="idpX509Certificate">IdP X509 Certificate</span>

- **Definition:** Public certificate used to verify SAML assertions from the IdP.
- **Example:** -----BEGIN CERTIFICATE-----\nMIIC...certificate content...\n-----END CERTIFICATE-----
- **Why it matters:** Ensures SAML assertions are genuinely from your IdP.
- **Note:**
  - Must be the actual certificate, not just the fingerprint
  - Include the BEGIN/END lines
  - Can be multi-line

### <span data-id="authorityUrl">Authority URL</span>

- **Definition:** URL to redirect users to the Sign In page.
- **Example:** https://adfs.company.com/adfs/ls/idpinitiatedsignon.aspx
- **Why it matters:** Used for user-initiated sign-in flows.
- **Note:** Optional, used for direct IdP-initiated logins

### <span data-id="nameId">Name ID Format</span>

- **Definition:** Format of the SAML NameID element that identifies users.
- **Default:** urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress
- **Example:** urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress
- **Why it matters:** Determines how users are identified in SAML assertions.
- **Note:** Email format is most common and recommended

## Service Provider (SP) Configuration

### <span data-id="entityId">SP Entity ID</span>

- **Definition:** Unique identifier for OpenMetadata as a Service Provider.
- **Example:** https://openmetadata.company.com/saml/metadata
- **Why it matters:** IdP uses this to identify OpenMetadata in SAML exchanges.
- **Note:** Must be configured in your IdP's trusted applications

### <span data-id="acs">Assertion Consumer Service (ACS) URL</span>

- **Definition:** URL where the IdP sends SAML assertions after authentication.
- **Example:** https://openmetadata.company.com/api/v1/saml/acs
- **Why it matters:** This is where SAML responses are posted after login.
- **Note:** Must be registered in your IdP configuration

### <span data-id="spX509Certificate">SP X509 Certificate</span>

- **Definition:** Public certificate for OpenMetadata (Service Provider).
- **Example:** -----BEGIN CERTIFICATE-----\nMIIC...certificate content...\n-----END CERTIFICATE-----
- **Why it matters:** Used by IdP to verify signed SAML requests from OpenMetadata.
- **Note:** Required if signing SAML requests

### <span data-id="spPrivateKey">SP Private Key</span>

- **Definition:** Private key for signing and encryption (Service Provider only).
- **Example:** -----BEGIN PRIVATE KEY-----\nMIIE...private key content...\n-----END PRIVATE KEY-----
- **Why it matters:** Used to sign SAML requests and decrypt encrypted assertions.
- **Note:**
  - Keep this secure and encrypted
  - Required if signing or encryption is enabled

### <span data-id="callback">SP Callback URL</span>

- **Definition:** URL where users are redirected after successful authentication.
- **Example:** https://openmetadata.company.com/saml/callback
- **Why it matters:** Where users land after successful SAML authentication.
- **Note:** Usually your OpenMetadata application URL

## Security Configuration

### <span data-id="strictMode">Strict Mode</span>

- **Definition:** Only accept valid signed and encrypted assertions if relevant flags are set.
- **Default:** false
- **Example:** true
- **Why it matters:** Enhances security by enforcing signature and encryption validation.
- **Note:** Enable for production environments

### <span data-id="validateXml">Validate XML</span>

- **Definition:** In strict mode, whether to validate XML format of SAML messages.
- **Default:** false
- **Example:** true
- **Why it matters:** Prevents XML-based attacks and ensures valid SAML format.
- **Note:** Should be enabled with strict mode

### <span data-id="tokenValidity">Token Validity</span>

- **Definition:** Validity period (in seconds) for JWT tokens created from SAML response.
- **Default:** 3600 (1 hour)
- **Example:** 7200 (2 hours)
- **Why it matters:** Controls how long users stay logged in.
- **Note:** Balance security vs usability

### <span data-id="sendEncryptedNameId">Send Encrypted Name ID</span>

- **Definition:** Encrypt Name ID when sending requests from Service Provider.
- **Default:** false
- **Example:** true
- **Why it matters:** Adds extra security for user identification.
- **Note:** Must be supported by your IdP

### <span data-id="sendSignedAuthRequest">Send Signed Auth Request</span>

- **Definition:** Whether to sign authentication requests sent to IdP.
- **Default:** false
- **Example:** true
- **Why it matters:** Ensures authenticity of requests from OpenMetadata.
- **Note:** Requires SP private key configuration

### <span data-id="signSpMetadata">Sign SP Metadata</span>

- **Definition:** Whether to sign Service Provider metadata.
- **Default:** false
- **Example:** true
- **Why it matters:** Ensures integrity of metadata exchanged with IdP.
- **Note:** Recommended for production environments

### <span data-id="wantAssertionsSigned">Want Assertions Signed</span>

- **Definition:** Require SAML assertions to be digitally signed by IdP.
- **Default:** false
- **Example:** true
- **Why it matters:** Ensures assertions haven't been tampered with.
- **Note:** Highly recommended for security

### <span data-id="wantMessagesSigned">Want Messages Signed</span>

- **Definition:** Require SAML messages to be digitally signed by IdP.
- **Default:** false
- **Example:** true
- **Why it matters:** Ensures entire SAML messages are authentic.
- **Note:** Provides additional security beyond assertion signing

### <span data-id="wantEncryptedAssertions">Want Encrypted Assertions</span>

- **Definition:** Require SAML assertions to be encrypted by IdP.
- **Default:** false
- **Example:** true
- **Why it matters:** Protects sensitive user data in transit.
- **Note:** Requires SP private key for decryption

### <span data-id="wantAssertionEncrypted">Want Assertion Encrypted</span>

- **Definition:** SP requires the assertion received to be encrypted.
- **Default:** false
- **Example:** true
- **Why it matters:** Ensures all assertion data is encrypted in transit.
- **Note:** Provides the highest level of data protection

## Advanced Configuration

### <span data-id="debugMode">Debug Mode</span>

- **Definition:** Enable debug logging for SAML authentication process.
- **Default:** false
- **Example:** true
- **Why it matters:** Helps troubleshoot SAML configuration issues.
- **Note:**
  - Only enable for troubleshooting
  - Disable in production for security and performance

### <span data-id="keyStoreFilePath">KeyStore File Path</span>

- **Definition:** Path to Java KeyStore file containing certificates and keys.
- **Example:** /path/to/saml-keystore.jks
- **Why it matters:** Alternative to inline certificates for key management.
- **Note:** Use either inline certificates or KeyStore, not both

### <span data-id="keyStoreAlias">KeyStore Alias</span>

- **Definition:** Alias of the certificate/key pair within the KeyStore.
- **Example:** saml-sp-cert
- **Why it matters:** Identifies which certificate to use from the KeyStore.
- **Note:** Must exist in the specified KeyStore

### <span data-id="keyStorePassword">KeyStore Password</span>

- **Definition:** Password to access the KeyStore file.
- **Example:** keystorePassword123
- **Why it matters:** Required to read certificates from the KeyStore.

## <span data-id="publicKeyUrls">Public Key URLs</span>

- **Definition:** List of URLs where public keys are published for token verification.
- **Example:** ["https://yourapp.company.com/.well-known/jwks.json"]
- **Why it matters:** Used to verify JWT token signatures if SAML generates JWT tokens for OpenMetadata.
- **Note:** Usually auto-discovered, may be used in hybrid SAML+JWT authentication

## <span data-id="jwtPrincipalClaims">JWT Principal Claims</span>

- **Definition:** JWT claims used to identify the user principal when SAML is combined with JWT tokens.
- **Example:** ["preferred_username", "email", "sub"]
- **Why it matters:** Determines which claim from JWT tokens identifies the SAML user.
- **Note:** Only applicable when SAML authentication generates JWT tokens for OpenMetadata

## <span data-id="jwtPrincipalClaimsMapping">JWT Principal Claims Mapping</span>

- **Definition:** Maps JWT claims to OpenMetadata user attributes for SAML users.
- **Example:** ["email:email", "name:displayName", "firstName:given_name"]
- **Why it matters:** Controls how SAML user information maps to OpenMetadata user profiles.
- **Note:** Format: "openmetadata_field:saml_claim" or "openmetadata_field:jwt_claim"

## <span data-id="tokenValidationAlgorithm">Token Validation Algorithm</span>

- **Definition:** Algorithm used to validate JWT token signatures when SAML uses token-based authentication.
- **Options:** RS256 | RS384 | RS512
- **Default:** RS256
- **Example:** RS256
- **Why it matters:** Must match the algorithm used to sign tokens in hybrid SAML+JWT setups.
- **Note:** Only relevant when SAML authentication generates or validates JWT tokens for OpenMetadata
