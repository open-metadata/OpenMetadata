# MCP authorization errors reach a remote web callback only through a link the user clicks

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `AuthorizationHandlerTest#testErrorForRemoteWebCallback_isALinkNotARedirect`, `OAuthHttpStatelessServerTransportProviderTest#authorizeErrorForRemoteWebCallback_isAPageWithALinkNotARedirect`, `UserSSOOAuthProviderTest#handleSSOErrorCallback_remoteWebCallbackGetsALinkNotANavigation`, `UriUtilsTest#isRemoteWebUri_onlyForHttpOnAnotherMachine`, `McpOAuthIT#authorizeErrorForAnHttpsCallbackIsALinkNotARedirect`
- **Related:** ADR:2026-10-30-the-mcp-callback-needs-the-state-of-a-pending-login

## Context

`/mcp/register` needs no credentials and accepts any `https` redirect URI, so a registered
callback is not a trusted one. `/mcp/authorize` sent every error raised after the redirect URI
check (an unknown scope, a malformed `code_challenge`, a provider error) to that callback with a
302, and the SSO error page navigated there by itself. Two requests turned the OpenMetadata host
into a redirector to a page of anyone's choosing, with no login or prompt in between. A
successful SSO sign-in passes the consent page, which names the destination
(ADR:2026-10-23-mcp-sso-asks-consent-after-the-idp-round-trip); the Basic and LDAP `/mcp/login`
form does not show it, but it redirects only after a correct password.

## Decision

- `UriUtils.isRemoteWebUri` is the one test: an `http` or `https` URI whose host is not loopback
  (`localhost`, `127.0.0.1`, `[::1]`).
- An authorization error for such a callback is answered with an OpenMetadata page that names the
  destination host and links to the same error URL a redirect would have used (`error`, `state`,
  `iss`). The `/mcp/authorize` page answers 400; the SSO error page keeps its 200. Neither page
  navigates by itself: no 302, meta refresh or script.
- The page shows the error code and a fixed sentence, not the error description, which can carry
  text from the request.
- Loopback and private-use scheme callbacks (desktop and IDE clients) keep the automatic redirect.
- Denying on the consent page also keeps its automatic redirect: the user has just seen the
  destination on that page and chosen to go back.

## Consequences

A hosted MCP client with an `https` callback still receives every error, one click later. Making
such a client redirect automatically again needs a list of trusted callback hosts, which this
record does not add.
