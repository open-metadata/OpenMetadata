# The UI runs only on user-login tokens; bot and personal access tokens are API-only

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** chirag-madlani
- **Guard:** `isApiOnlyToken` and `getOidcToken` tests in `openmetadata-ui/src/main/resources/ui/src/utils/SwTokenStorageUtils.test.ts`; the sign-out wiring test in `src/components/Auth/AuthProviders/AuthProvider.test.tsx`
- **Related:** #36250, #36318, #36319

## Context
Bot tokens and personal access tokens are issued for API clients and automation. Interactive UI
sessions should come from the login flow, so the UI needs a single, explicit rule for which stored
tokens it runs on.

## Decision
The UI accepts only tokens from a user login flow. `getOidcToken()` in `SwTokenStorageUtils.ts`
checks every stored token it reads with `isApiOnlyToken()`, which rejects a token whose claims
have:

- `isBot: true`, or
- `tokenType` `BOT` (this also covers bot-impersonation tokens, which carry `isBot: false`), or
- `tokenType` `PERSONAL_ACCESS`.

For a rejected token, the read returns `''`, the stored session is cleared, and the listener that
`AuthProvider` registers runs once: it shows a toast and does the full sign-out. OM-issued login
tokens (`tokenType` `OM_USER`), SSO provider tokens (no `tokenType`) and non-JWT tokens are
allowed.

This is a UI rule, not a server one. Bot tokens and personal access tokens keep working against the
REST API unchanged, because the server cannot reliably tell a UI request from an API request.

## Consequences
- Tests that need bot access check it through the API, not the UI. The ingestion bot's
  domain-access check lives in `DomainIsolationIT`, and the msal-mock SSO fixture signs in with a
  mock-IdP token instead of a personal access token.
- The check depends on the server's claim names: `isBot` and `tokenType`, with values from
  `serviceTokenEnum.json`. Renaming a claim or adding a token type requires updating
  `isApiOnlyToken`.
- It is a client-side session rule that complements server-side authorization; it does not
  replace it.
- A refresh already in flight when the sign-out starts can still restore the session; that race
  affects every sign-out and is tracked in #36319.
