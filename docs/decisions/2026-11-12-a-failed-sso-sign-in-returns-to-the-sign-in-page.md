# A failed SSO sign-in returns to the sign-in page with a fixed reason code

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `SsoOidcConfidentialLoginIT` (OC-07, OC-14, OC-17, ID-13),
  `AuthenticationCodeFlowHandlerTest`, `SignInPage.test.tsx`
- **Related:** 2.1.0 release testing, SSO row

## Context
The confidential OIDC callback answered every failure with a raw 500 page carrying the exception
text: the identity provider refusing the sign-in (`access_denied`), a wrong client secret, a token
endpoint that errors or does not answer, and an account the deployment may not provision
(self-signup off, a registration domain not allowed). The person signing in landed on a dead end,
and the page showed server or provider detail.

## Decision
- These failures redirect the browser to `/signin?error=<code>` on the deployment's base URL, with
  one of three fixed codes (`SignInFailure`): `provider_refused`, `token_exchange_failed`,
  `account_not_allowed`. The provider's error description and the server's exception stay in the
  server log; nothing else from the failure reaches the URL.
- The sign-in page maps a known code to a translated message and any other value to a generic one,
  so the URL cannot put text on the page. It does not auto-redirect to the identity provider while
  it shows a failure, which would loop.
- A sign-in started by an MCP client keeps the error status its callback reads.
- Other callback failures (state, nonce or issuer mismatches, unexpected errors) are unchanged.

## Consequences
A person who cannot sign in learns why in a sentence they can act on, and can try again from the
same page. Adding a reason means a new `SignInFailure` constant and its message on the sign-in
page; the code is the contract between the two.
