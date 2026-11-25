# Personal activity feeds can be read for another user with view on that user

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** Rohit Jain
- **Guard:** `ActivityResourceIT#test_personalFeedsCanBeScopedToAnotherUser`, `#test_personalFeedsOfAnotherUserAreFilteredToWhatTheCallerMayView`, `#test_personalFeedsForAnotherUserRequireViewOnThatUser`, `#test_personalFeedsOfSoftDeletedUserStayReadable`
- **Related:** #35944

## Context
The settings modal's user detail (Settings › Members › Users › a user, and `#profile/<name>`)
shows a user's Activity with All / Mentions / My Assets / Following, as the legacy `/users/<name>`
page did. `/v1/activity/my-feed`, `/following` and `/mentions` only ever computed the caller's own
feed, so another user's sub-feeds could not be shown.

## Decision
- `GET /v1/activity/my-feed`, `/following` and `/mentions` take an optional `userId` (UUID).
  Absent, or equal to the caller, the feed is the caller's and nothing about the call changes.
- For another user the feed is computed for that user and their teams, after a `ViewBasic` check on
  that user. Admins pass it; a principal denied `ViewBasic` on users gets 403.
- The requested user is resolved with `Include.ALL`, so a soft-deleted user's feeds stay readable
  while their profile is (as `/v1/activity/user/{userId}` already allowed).
- The events returned are still filtered to what the **caller** may view; the parameter widens whose
  feed is computed, never what the caller sees.

## Consequences
- Any client can show another user's personal feeds without a new endpoint; the UI does so in the
  user detail's Activity tab.
- Seeing someone's mentions or followed-asset activity now depends on `ViewBasic` on that user, the
  same grant that shows their profile. Tightening it would need a dedicated operation and a new
  record.
- `/v1/activity/user/{userId}` deliberately keeps no `ViewBasic` gate on the user. It returns only
  what that user did, each event already filtered to what the caller may view, and the actor is
  shown on those entities' own activity anyway; mentions and followed assets are not otherwise
  visible. Gating it would turn a working read into a 403 for principals denied `ViewBasic` on
  users.
