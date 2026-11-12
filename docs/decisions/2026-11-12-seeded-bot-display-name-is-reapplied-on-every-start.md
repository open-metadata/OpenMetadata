# A bot user seed's displayName is re-applied on every server start

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Harsh Vador; backend reviewers of open-metadata/OpenMetadata#37629
- **Guard:** `BotUserSeedTest` (the seed's `displayName` reaches the seeded user); reviewer for the restart behaviour
- **Related:** open-metadata/OpenMetadata#37629, open-metadata/openmetadata-collate#8485

## Context

Bot users are seeded from `json/data/botUser/*.json` on every start by `BotResource.seedBotUser`,
which PUTs the user as `admin`. Until #37629 the seeded user was built without `displayName`, so a
seed could not name its bot and every bot rendered by its login name (`aiautomationapplicationbot`).
Collate's AI Automation bot seed now sets one.

The same PUT already applies other seed fields differently: the impersonation grant applies on first
creation only, because `UserUpdater` keeps the stored value. `displayName` has no such guard:
`EntityUpdater.updateDisplayName` keeps a stored value only when the update comes from a bot, and
seeding runs as `admin`.

## Decision

A botUser seed's `displayName` is re-applied on every server start and overrides edits made
through the API. A seed without `displayName` leaves it unset. That is also what restarts did before
#37629: they reset any edited display name to `null`.

The seed is the contract: OpenMetadata and Collate name a seeded bot by setting `displayName` in its
botUser seed file, not through the API.

## Consequences

- A product rename of a seeded bot is a one-line seed change, and existing installs pick it up on
  their next restart.
- An admin cannot rename a seeded bot persistently; the next start restores the seed value.
- Revisit if admins need to rename seeded bots: that needs a first-creation-only rule for
  `displayName`, like the impersonation grant.
