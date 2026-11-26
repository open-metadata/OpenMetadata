# SAML runtime trust preserves explicitly configured signing keys

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** OpenMetadata maintainers (PR review)
- **Guard:** `SamlSettingsHolderTest.initializesLiveSettingsWhenAllSavedIdpCertificatesHaveExpired`, `SamlValidatorTest`
- **Related:** #37056, #38219, #38302, ADR:2026-11-19-saml-encryption-policy-and-rollover-certificates

## Context
SAML settings are constructed during server startup. Rejecting an entirely expired saved IdP
certificate bundle prevents the whole server from starting, including APIs, bots and ingestion.
Before the bundle change, java-saml verified signatures with explicitly configured public keys
without treating certificate validity dates as runtime revocation.

## Decision
Runtime settings retain all explicitly configured, parseable IdP signing certificates,
including expired and future rollover certificates. Certificate expiry alone neither removes a
pinned trust anchor nor prevents server startup. Signature, assertion lifetime, audience,
destination, response correlation and encryption-policy checks remain in force.

Static configuration validation still requires at least one currently valid signing certificate.
An administrator retires a trusted key by removing it from the stored configuration. There is no
new automatic certificate-expiry or revocation mechanism.

This supersedes only the expired-certificate filtering rule in
ADR:2026-11-19-saml-encryption-policy-and-rollover-certificates. The bundle format, metadata
selection, static validation and explicit encryption policy remain unchanged.

## Consequences
Existing SAML installations keep their pre-upgrade restart and signature-verification behavior.
Operators must rotate IdP certificates and explicitly remove retired keys; expiry is not a substitute
for removing a compromised pinned key. A stricter runtime validity policy would require a separate
rollout and recovery design that cannot take unrelated server functions down.
