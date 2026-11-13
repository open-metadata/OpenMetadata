# The SAML configuration check sends the sign-in request the live login sends

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `SamlValidatorTest` (`validateSamlConfigurationSignsTheCheckRequestWhenRequestSigningIsOn`,
  `validateSamlConfigurationShowsTheIdpReasonWhenItRejectsAnUnsignedRequest`,
  `validateIdpConnectivityReportsSamlClientErrorsWithTheIdpReason`), `IdpErrorResponseTest`
- **Related:** open-metadata/OpenMetadata#37056

## Context
Saving or validating a SAML configuration runs `SamlValidator`, which sends a sign-in request to
the IdP SSO Login URL and blocks the save when the IdP rejects it. The check built its own
AuthnRequest and never signed it, read the first 500 bytes of the reply, let any 4xx pass whose
first bytes mentioned "saml" or "invalid", and otherwise reported "SSO URL returned error (HTTP
400). Please verify the URL is correct." A Microsoft Entra application that requires signed
requests answers an unsigned request with AADSTS76021, so a configuration that does sign its
requests could not be saved. Entra's reason exists only in the page's `$Config` script, past the
first 500 bytes, so it was never shown.

## Decision
- The check sends the request the live login sends: OneLogin builds it from the candidate
  configuration with `SamlSettingsHolder.buildSettings` and signs it whenever
  `sendSignedAuthRequest` is on. Its RelayState is `openmetadata-configuration-check`.
- A 2xx or 3xx answer passes. 404 and 405 keep their SSO URL messages. Any other answer fails the
  check with the IdP's own reason: Entra's `strServiceExceptionMessage` (JSON- and HTML-unescaped,
  up to 1000 characters), otherwise the first 300 characters of the page's visible text. At most
  64 KiB of the reply is read.
- A configuration OneLogin cannot turn into that request fails the check, because the live login
  cannot start either: an SP key OneLogin cannot load is reported on the SP private key field.
- Not reaching the IdP from the server stays a warning: users' browsers, not the server, follow the
  SSO Login URL at login.

## Consequences
The check no longer passes a configuration the IdP rejects at login, and a rejection names the
IdP's reason. IdP errors are never downgraded to warnings by their wording. A 4xx caused only by
the server-side context, such as an IdP that blocks non-browser clients, now fails the save where a
page mentioning "saml" or "invalid" used to pass. Revisit this if an IdP is found that rejects the
check's request but accepts the identical request from a browser.
