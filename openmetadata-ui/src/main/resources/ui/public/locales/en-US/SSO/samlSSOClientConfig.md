---
title: SAML SSO Configuration | OpenMetadata
description: Configure SAML Single Sign-On for OpenMetadata with complete field reference
slug: /main-concepts/metadata-standard/schemas/security/client/saml-sso
---

SAML (Security Assertion Markup Language) SSO enables users to log in using SAML Identity Providers like Active Directory Federation Services (ADFS), Shibboleth, or other enterprise identity providers.

## Setup Workflow

To configure SAML authentication, follow these steps:

1. **Get OpenMetadata Service Provider Details** (from this form):
   - **SP Entity ID** - Auto-generated, read-only field
   - **Assertion Consumer Service (ACS) URL** - Auto-generated, read-only field

2. **Configure Your Identity Provider**:
   - Create a new SAML application/service in your IdP (ADFS, Okta, Azure AD, etc.)
   - **Copy and paste** the SP Entity ID as the Entity ID/Application ID in your IdP
   - **Copy and paste** the ACS URL as the Reply URL/Callback URL/Consumer URL in your IdP
   - Configure user attributes and claims mapping in your IdP

3. **Get Identity Provider Details** (from your IdP):
   - IdP Entity ID
   - SSO Login URL
   - IdP X509 Certificate

4. **Complete OpenMetadata Configuration**:
   - Enter the IdP details in the form below
   - Configure security settings (signing, encryption)
   - Save the configuration

**Important:** The SP Entity ID and ACS URL are generated automatically based on your OpenMetadata URL and cannot be changed. You must use these exact values in your IdP configuration for SAML to work.

## <span data-id="enableSelfSignup">Enable Self Signup</span>

- **Definition:** Allows users to automatically create accounts on first SAML login.
- **Options:** Enabled | Disabled
- **Example:** Enabled
- **Why it matters:** Controls whether new SAML users can join automatically or need manual approval.
- **Note:** Disable for stricter control over user access

## Identity Provider (IdP) Configuration

### <span data-id="entityId">IdP Entity ID</span>

- **Definition:** Unique identifier for the Identity Provider.
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

### <span data-id="nameId">Name ID Format</span>

- **Definition:** Format of the SAML NameID element that identifies users.
- **Default:** urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress
- **Example:** urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress
- **Why it matters:** Determines how users are identified in SAML assertions.
- **Note:** Email format is most common and recommended

## Service Provider (SP) Configuration

### <span data-id="entityId">SP Entity ID</span>

- **Definition:** Unique identifier for OpenMetadata as a Service Provider.
- **Example:** https://openmetadata.company.com
- **Auto-Generated:** This field is automatically populated based on your OpenMetadata deployment URL.
- **Why it matters:** IdP uses this to identify OpenMetadata in SAML exchanges.
- **Note:**
  - **This field is read-only** - it cannot be edited
  - **Copy this value** and paste it as the Entity ID (or Application ID) in your SAML Identity Provider configuration
  - Must match exactly in your IdP's trusted applications list

### <span data-id="acs">Assertion Consumer Service (ACS) URL</span>

- **Definition:** URL where the IdP sends SAML assertions after authentication.
- **Example:** https://openmetadata.company.com/callback
- **Auto-Generated:** This field is automatically populated based on your OpenMetadata deployment URL.
- **Why it matters:** This is where SAML responses are posted after login.
- **Note:**
  - **This field is read-only** - it cannot be edited
  - **Copy this value** and paste it as the ACS URL (also called Reply URL, Callback URL, or Consumer URL) in your SAML Identity Provider configuration
  - Format is always: `{your-domain}/callback`
  - Must be registered exactly in your IdP configuration

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

## Security Configuration

### <span data-id="strictMode">Strict Mode</span>

- **Definition:** Only accept valid signed and encrypted assertions if relevant flags are set.
- **Default:** false
- **Example:** true
- **Why it matters:** Enhances security by enforcing signature and encryption validation.
- **Note:** Enable for production environments

### <span data-id="tokenValidity">Token Validity (seconds)</span>

- **Definition:** Validity period (in seconds) for JWT tokens created from SAML response.
- **Default:** 3600 (1 hour)
- **Example:** 7200 (2 hours)
- **Why it matters:** Controls how long users stay logged in after SAML authentication.
- **Note:** This controls the OpenMetadata JWT token lifetime, not the SAML assertion lifetime

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

## Advanced Configuration

### <span data-id="debugMode">Debug Mode</span>

- **Definition:** Enable debug logging for SAML authentication process.
- **Default:** false
- **Example:** true
- **Why it matters:** Helps troubleshoot SAML configuration issues.
- **Note:**
  - Only enable for troubleshooting
  - Disable in production for security and performance

---

## Authorizer Configuration

The following settings control authorization and access control across OpenMetadata. These settings apply globally to all authentication providers.

### <span data-id="adminPrincipals">Admin Principals</span>

- **Definition:** List of user principals who will have admin access to OpenMetadata.
- **Example:** ["john.doe", "jane.admin", "admin"]
- **Why it matters:** These users will have full administrative privileges in OpenMetadata.
- **Note:**
  - Use usernames (NOT full email addresses)
  - At least one admin principal is required
  - For SAML, username is derived from NameID (if email format, uses part before @)

### <span data-id="principalDomain">Principal Domain</span>

- **Definition:** Default domain for user principals.
- **Example:** company.com
- **Why it matters:** Used to construct full user principals when only username is provided.
- **Note:** Typically your organization's domain

### <span data-id="enforcePrincipalDomain">Enforce Principal Domain</span>

- **Definition:** Whether to enforce that all users belong to the principal domain.
- **Default:** false
- **Example:** true
- **Why it matters:** Adds an extra layer of security by restricting access to users from specific domains.
- **Note:** When enabled, only users from the configured principal domain can access OpenMetadata

### <span data-id="allowedDomains">Allowed Domains</span>

- **Definition:** List of email domains that are permitted to access OpenMetadata.
- **Example:** ["company.com", "partner.com"]
- **Why it matters:** Provides fine-grained control over which email domains can authenticate via SAML.
- **Note:**
  - Works in conjunction with `enforcePrincipalDomain`
  - When `enforcePrincipalDomain` is enabled, only users with email addresses from these domains can access OpenMetadata
  - Leave empty or use single `principalDomain` if you only have one domain
  - Use this field for multi-domain organizations
