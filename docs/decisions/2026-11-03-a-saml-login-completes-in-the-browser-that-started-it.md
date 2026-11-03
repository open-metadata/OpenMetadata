# A SAML login completes in the browser that started it, with the answer to its own request

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `SsoSamlLoginIT`, `SamlAuthServletHandlerTest`, `SessionServiceTest` (`recordPending*`)
- **Related:** open-metadata/openmetadata-collate#8018

## Context
The identity provider's response reaches the ACS as a cross-site POST, which does not carry the
`SameSite=Lax` `OM_SESSION` cookie. So the ACS found the pending login by the `RelayState` field alone
and activated a session for whichever browser posted the form. The response was also never matched to
the AuthnRequest that login had sent.

## Decision
- `/api/v1/saml/login` stores the AuthnRequest id on the pending session (`state`).
- The ACS accepts only a response whose `InResponseTo` is that id, in strict mode or not. It then
  attaches the account to the pending session, clears the id, and answers `303` to
  `/api/v1/saml/complete`.
- `GET /api/v1/saml/complete` is a same-site top-level navigation, so it carries the session cookie. It
  activates the pending session named by that cookie, provided the ACS attached an account to it,
  and redirects to the callback with the token as before. Without such a session it answers 401 and
  leaves the browser's cookie alone.
- MCP logins over SAML keep their own correlation for now.

## Consequences
A SAML login takes one more redirect. Unsolicited (IdP-initiated) responses are refused. The ACS no
longer starts sessions or mints tokens itself. An identity provider's response is usable once, by
the browser that started the login.
