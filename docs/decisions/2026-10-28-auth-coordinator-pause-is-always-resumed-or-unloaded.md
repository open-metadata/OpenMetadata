# Every AuthCoordinator pause is ended by resume() or by leaving the page

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `AuthCoordinator.test.ts` (`a refresh overtaken by a sign-out`); `AuthProvider.test.tsx`
  (`pauses the coordinator before logging out so an armed timer cannot redirect`); reviewer for new
  `pause()` callers and new `invokeSilentReauth` implementations
- **Related:** #36319, #36447

## Context
A silent refresh in flight while the user signed out could still save its token and emit
`refreshed`, which signed the user back in. A request that 401'd during the `/logout` round-trip
could also start a new refresh. `authCoordinator.pause()` only cancelled the proactive timer, so
nothing stopped either refresh.

## Decision
- `pause()` holds every refresh in the tab: none may start, and one already in flight is dropped
  without persisting its token or emitting `refreshed` / `refresh-failed`. Queued requests reject
  with `RefreshFailedError`. `resume()` lifts the hold and drops any refresh still in flight.
- Every `pause()` is ended by `resume()` or by the page unloading:
  - `signOut()` pauses at its start and resumes in its `finally`.
  - `startSilentReauth()` pauses and does not resume, because `invokeSilentReauth` leaves the page.
- Every authenticator's `invokeSilentReauth` therefore must navigate the whole page away (OIDC
  `signinRedirect`, Auth0 `loginWithRedirect`, Okta `signInWithRedirect`, MSAL
  `acquireTokenRedirect` / `loginRedirect`, Generic `location.assign`). If it throws, the caller
  signs out through `signOut()`, which resumes.

## Consequences
A sign-out can no longer be undone by a refresh in this tab or in another tab whose sign-out marker
is already stored.

A silent re-authentication that finishes without leaving the page, such as an iframe or a popup,
would leave the coordinator paused: every later 401 fails, and no `refresh-failed` fires to recover.
Adding one requires `startSilentReauth` to call `resume()` once it finishes. Calling `resume()`
after a redirect call does not work, because those calls can resolve before the page unloads.
