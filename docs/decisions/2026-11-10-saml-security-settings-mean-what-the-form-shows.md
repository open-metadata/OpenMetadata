# SAML security settings mean what the settings form shows

- **Status:** Accepted
- **Revisions:** v1 2026-11-10 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `SamlResponseValidatorTest` (`wantMessagesSignedHoldsWithoutStrictMode`,
  `wantAssertionsSignedHoldsWithoutStrictMode`), `SamlAuthServletHandlerTest`
  (`handleCallback_holdsWantMessagesSignedWithoutStrictMode`), `SamlSettingsHolderTest`
  (`buildSettingsGivesJavaSamlTheSpKeyWithoutRequestSigning`)
- **Related:** open-metadata/OpenMetadata#37056,
  ADR:2026-11-09-the-saml-configuration-check-sends-the-live-sign-in-request

## Context
The SSO settings form shows Strict Mode, Want Assertions Signed, Want Messages Signed and Send
Signed Auth Request as independent switches, next to fields for the SP certificate and private key.
java-saml checks the two "want … signed" switches only in strict mode, so with strict mode off they
did nothing. OpenMetadata gave java-saml the SP certificate and key only when the SP signed requests
or required encrypted assertions, and the form hides the encryption switch. Microsoft Entra encrypts
assertions once token encryption is on, whatever the SP asks for, so a configuration with request
signing off could not decrypt the assertion even though its key was filled in.

## Decision
- Want Messages Signed and Want Assertions Signed hold whether or not strict mode is on.
  `SamlResponseValidator`, which already applies java-saml's strict-only checks to every response,
  rejects a response whose `Response` or `Assertion` element lacks the signature the switch asks
  for. The reason uses java-saml's wording: "The Message of the Response is not signed and the SP
  requires it" and "The Assertion of the Response is not signed and the SP requires it".
- The SP certificate and private key go to java-saml whenever they are configured. They stay
  required only when the SP signs requests or requires encrypted assertions. The keystore is still
  read only in those two cases.

## Consequences
A switch in the form now does what it says. A configuration that turned on a "want … signed" switch
with strict mode off, behind an identity provider that does not sign that element, stops logging in
until the identity provider signs it or the switch is turned off; the login error names the element.
SP metadata publishes the SP certificate whenever it is configured. Revisit the first rule if strict
mode is removed or java-saml starts enforcing these switches outside strict mode.
