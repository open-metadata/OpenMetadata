# SAML encryption is an explicit policy and metadata carries rollover certificates

- **Status:** Accepted; runtime expired-certificate filtering superseded by ADR:2026-11-20-saml-runtime-trust-preserves-configured-signing-keys
- **Revisions:** v1 2026-11-19 (initial) · v2 2026-11-20 (runtime trust compatibility)
- **Deciders:** Mohit Yadav
- **Guard:** `SamlResponseValidatorTest`, `SamlSettingsHolderTest`, `SSOUtils.test.ts`
- **Related:** #37056, #38219, #38197, ADR:2026-11-10-saml-security-settings-mean-what-the-form-shows

## Context
Microsoft Entra can publish multiple signing certificates. Importing only one rejects valid
responses signed by another advertised key. An SP private key can sign requests or decrypt
assertions; its presence does not prove that the IdP has enabled token encryption.

The previous decision hid encryption in the form. Enforcing a previously stored encryption flag
outside strict mode can therefore reject a login that worked before the upgrade.

## Decision
- Request signing and required assertion encryption are independent, optional settings, both
  defaulting to false. A configured SP key alone never requires encryption. The existing form
  exposes Require Encrypted Assertions so administrators can see and change the saved policy.
- `wantAssertionEncrypted=true` rejects plaintext assertions in live login and Test Login even
  with Strict Mode off. It is an explicit confidentiality requirement. The signed-message and
  signed-assertion switches retain their strict-mode semantics; this does not change those rules.
- Configuration checks validate local configuration only. A successful check does not establish
  that the IdP encrypts tokens; Test Login verifies the actual response.
- `idpX509Certificate` remains a string: one PEM certificate, a concatenated PEM bundle, or one
  legacy base64 DER certificate. Metadata import includes signing and unspecified-use keys,
  excludes encryption-only descriptors, and deduplicates certificates. Static checks require at
  least one currently valid certificate. Settings construction excludes expired certificates and
  retains future rollover keys because settings are cached. Settings must be reloaded after
  certificate retirement; this change does not add a periodic certificate-expiry scheduler.

## Consequences and upgrade procedure
Before upgrading, inspect `authenticationConfiguration.samlConfiguration.security.wantAssertionEncrypted`
in the saved configuration, particularly if Strict Mode is off. If plaintext assertions are intended,
set it to false using the authenticated security configuration API (`PUT /api/v1/system/security/config`)
on the previous version. Preserve the other configuration fields and secrets. If encryption is intended,
activate the matching SP public certificate in the IdP token-encryption settings and test sign-in.
An Entra verification certificate enables signed requests; it does not enable token encryption.

Keep an authenticated administrator session available while testing. For a SAML-only deployment
already locked out with no usable administrator session, roll back the application to the previous
version, sign in and correct the saved flag, then upgrade again. Do not disable signature validation
or assume changing YAML overrides the database configuration. The saved false flag remains false;
there is no automatic migration that weakens an explicit true policy.

## Amendment v2 — runtime certificate validity
The runtime filtering rule above is superseded by
ADR:2026-11-20-saml-runtime-trust-preserves-configured-signing-keys. All explicitly configured
signing keys remain available at runtime, while static validation still requires an active key.
An expired saved certificate must not prevent the entire server from restarting.
