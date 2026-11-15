# User writes keep the stored login and activity times

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `UserResourceIT#test_updateUser_keepsLoginAndActivityTimes`
- **Related:** issue #36697, PR #36703, open-metadata/openmetadata-collate#8062

## Context

`lastLoginTime` and `lastActivityTime` are written by the server: on login, and by
`UserActivityTracker` with a direct SQL update on each authenticated request. A PATCH loaded the
user without them and a PUT saved a body that never carries them, so any edit, PUT or soft delete
cleared both. Online users, the `last_activity` metric and Collate's User Adoption page then read an
active user as never seen.

## Decision

A user PATCH, PUT or soft delete keeps the stored `lastLoginTime` and `lastActivityTime`. Both are in
the PATCH and PUT field lists, and on a PUT a missing value means "keep the stored one". A PATCH
that explicitly removes either field still clears it.

## Consequences

A PUT reads the stored user through the 30-second entity cache, which the tracker's direct SQL write
does not clear, so a PUT inside that window can write back an older `lastActivityTime`. Older is
accepted; empty is not, and the next tracker flush writes the current time again. PATCH and soft
delete read the row fresh, so they are not affected. Revisit if the tracker starts writing through
the repository or evicting the entity cache.
