# SAML security settings mean what the settings form shows

- **Status:** Accepted
- **Revisions:** v1 2026-11-10 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `useSsoConfiguration.test.ts` ("offers the SAML signing switches only while Strict Mode
  is on"), `SamlSettingsHolderTest` (`buildSettingsGivesJavaSamlTheSpKeyWithoutRequestSigning`)
- **Related:** open-metadata/OpenMetadata#37056,
  ADR:2026-11-09-the-saml-configuration-check-sends-the-live-sign-in-request

## Context
The SSO settings form showed Strict Mode, Want Assertions Signed, Want Messages Signed and Send
Signed Auth Request as independent switches, next to fields for the SP certificate and private key.
java-saml checks the two "want … signed" switches only in strict mode, so with Strict Mode off they
did nothing. Enforcing them outside strict mode was considered and rejected: a deployment that had
turned one on behind an identity provider that does not sign that element would stop logging in on
upgrade (Keycloak's default client signs the Response but not the Assertion), and with SAML as the
only login the admin could not reach the form to turn it off. Separately, OpenMetadata gave
java-saml the SP certificate and key only when the SP signed requests or required encrypted
assertions, and the form hides the encryption switch. Microsoft Entra encrypts assertions once token
encryption is on, whatever the SP asks for, so a configuration with request signing off could not
decrypt the assertion even though its key was filled in.

## Decision
- Want Messages Signed and Want Assertions Signed keep java-saml's meaning: they apply only in
  strict mode, and the settings form shows them only while Strict Mode is on. Values stored while
  they are hidden are kept and take effect when Strict Mode is turned on.
- The SP certificate and private key go to java-saml whenever they are configured. They stay
  required only when the SP signs requests or requires encrypted assertions. The keystore is still
  read only in those two cases.

## Consequences
The form no longer offers a switch that does nothing, and no login that works today stops working.
SP metadata publishes the SP certificate whenever it is configured. Revisit the first rule if
java-saml starts enforcing these switches outside strict mode, or if OpenMetadata gets a way to
roll out a stricter login check without locking out SAML-only deployments.
