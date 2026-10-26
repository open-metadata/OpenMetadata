# A feed post's actions sit in a menu of Edit and Delete, and the feed offers no Resolve

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** UI team
- **Guard:** `ActivityFeedActions.test.tsx` (the menu offers exactly Edit and Delete), and the
  `ActivityFeed: conversation actions on the Activity tab` Playwright test
- **Related:** open-metadata/OpenMetadata#36162,
  ADR:2026-10-26-conversation-drawers-style-the-reply-count-and-message-like-the-inbox

## Context
The description conversation drawers (#36162) moved a conversation's Edit and Delete into a ⋮ menu
and dropped Reply and Resolve, while the entity Activity Feeds & Tasks tab kept a hover bar of
Reply, Resolve, Edit and Delete. The two surfaces render the same conversation card, so the same
post showed two different sets of actions. On the Activity tab the message icon also opened
nothing, which left the hover bar's Reply as the only way into the reply drawer.

## Decision
- `ActivityFeedActions` renders one thing: a ⋮ menu holding Edit and Delete, each shown by the
  author-or-admin rule (or the caller's `canEdit`/`canDelete`). There is no hover bar and no
  `asMenu` switch. This covers conversation cards, their replies and task comments.
- Replying goes through the footer's message icon, which opens the reply drawer for a conversation
  or an activity on every surface that does not hand the press to its caller.
- The feed offers no Resolve action. The conversation's `resolved` field and its PATCH stay in the
  API; only the UI affordance is gone.

## Consequences
Every feed surface shows the same actions in the same place, and the menu needs no hover to be
reached by keyboard or touch. A conversation cannot be resolved from the UI; bringing Resolve back
means adding it to this menu (and revising this record), not restoring a separate hover bar.
