# A bot avatar icon is a UserClassBase hook, and OSS merges before Collate

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** Rohit Jain
- **Guard:** `ProfilePicture.test.tsx`; merge-order review
- **Related:** [OpenMetadata #38082](https://github.com/open-metadata/OpenMetadata/pull/38082), [openmetadata-collate #8680](https://github.com/open-metadata/openmetadata-collate/pull/8680)

## Context

A bot's avatar came only from `UserClassBase.getBotLogo(botName)`: an image URL that
`getUserWithImage` sets as the bot's profile image and `ProfilePicture` draws in an `<img>`. Collate
wants some of its AI bots drawn with a core-ui icon component (`AppCollateAiChatColored`), so the
artwork stays in step with the design-system icon set. A component cannot travel through a URL map.

## Decision

`UserClassBase.getBotIcon(botName)` returns an icon component keyed by the bot user's `name`.
OpenMetadata registers none. A distribution fills `botIcons` in its `UserClassBase` subclass,
spreading the inherited map.

When it returns an icon for a bot, `ProfilePicture` draws the bot as an `Avatar` with that icon as
`placeholderIcon`, with no `src` and no initials (`Avatar` draws initials ahead of an icon), on a
transparent surface with no outline. The icon wins over a `getBotLogo` URL. The icon component owns
its own sizing and shape; `ProfilePicture` does not resize it.

Merge OpenMetadata #38082 first. The Collate override follows it and moves Collate's `OpenMetadata`
submodule onto the merged commit, because Collate cannot build against an OpenMetadata that lacks
the method.

## Consequences

A bot avatar is either a registered icon, a registered logo URL, or the default initials avatar,
never a special case in `ProfilePicture`. `getBotLogo` still feeds every other consumer of the
bot's profile image (for example the entity popover's image data). With no icons registered,
OpenMetadata renders exactly as before.
