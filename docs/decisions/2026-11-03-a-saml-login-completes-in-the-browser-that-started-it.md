# A SAML login completes in the browser that started it, with the answer to its own request

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial); v2 2026-11-04 (completion also needs the code the ACS
  answer carries)
- **Deciders:** Mohit Yadav
- **Guard:** `SsoSamlLoginIT`, `SamlAuthServletHandlerTest`, `SessionServiceTest` (`recordPending*`)
- **Related:** open-metadata/openmetadata-collate#8018

## Context
The identity provider's response reaches the ACS as a cross-site POST, which does not carry the
`SameSite=Lax` `OM_SESSION` cookie, so the ACS cannot tell which browser posted it. A login
therefore finishes in two steps: the ACS checks that the response answers the AuthnRequest this
login sent, and a same-site navigation, which carries the cookie, activates the session in the
browser that started the login. That navigation follows the ACS answer, so it also carries what
the ACS put in it: the login completes only in a browser that both started it and delivered the
identity provider's response.

## Decision
- `/api/v1/saml/login` stores the AuthnRequest id on the pending session (`state`).
- The ACS accepts only a response whose verified assertion answers that id, in the `InResponseTo`
  of its bearer subject confirmation, in strict mode or not. The response element's own
  `InResponseTo` is not read, because no signature covers it when only the assertion is signed.
  The ACS then attaches the account to the pending session, clears the id, stores the SHA-256 of a
  new random one-time code on the session (`nonce`, unused by SAML logins otherwise), and answers
  `303` to `/api/v1/saml/complete?code=<code>` on the origin of the login's validated redirect
  URI, where the login started and its host-only cookie lives, not on the ACS host.
- `GET /api/v1/saml/complete` is a same-site top-level navigation, so it carries the session cookie. It
  activates the pending session named by that cookie, provided the ACS attached an account to it
  and the request's `code` hashes to the stored value, and redirects to the callback with the
  token as before. It reads that session from the session
  store, not the server's cache, because the ACS may have run on another server. Without such a
  session, or without the matching code, it answers 401 and leaves the browser's cookie alone.
- MCP logins over SAML keep their own correlation for now.

## Consequences
A SAML login takes one more redirect. Unsolicited (IdP-initiated) responses are refused. The ACS
starts no session and mints no token itself. An identity provider's response is usable once, by
the browser that started the login and delivered that response.
