# The conversation drawers style their reply count and message like the Inbox until core ships those variants

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** UI team
- **Guard:** reviewer
- **Related:** ADR:2026-10-11-migrated-antd-components-adopt-core-styling, ADR:2026-10-24-conversation-drawers-are-40vw-wide-with-a-480px-floor, open-metadata/OpenMetadata#36152, open-metadata/OpenMetadata#36162

## Context
The conversation drawers (the one opened from an entity's description, `ActivityThreadPanel`, and
the one its Reply opens, `ActivityFeedDrawer`) were brought in line with the Inbox: a labelled reply
count ("6 Replies") and the message on a recessed surface, so it does not blend into the card in
dark mode. No core component expresses either look — core `Button`'s `tertiary` draws a 20px gray
icon with `px-3`, and core `Card` has no recessed, borderless variant. The Inbox gets the same look
with the same caller-side classes (`FOOTER_BUTTON_CLASS` in `ActivityFeedItem.tsx`).

## Decision
Until `@openmetadata/ui-core-components` ships an Inbox-style labelled footer button and a recessed
`Card` variant, the conversation drawers may restyle core components from the call site, as an
exception to ADR:2026-10-11-migrated-antd-components-adopt-core-styling:

- the drawer's labelled reply count over core `Button` — `LABELLED_REPLY_CLASS` in
  `FeedCardFooterNew.tsx` (padding, and the icon slot's size and colour), rendered only when
  `showReplyCount` is set;
- the drawer message over core `Card` — `tw:border-transparent` plus
  `INBOX_RECESSED_SURFACE_CLASS` in `FeedCardBodyNew.tsx`, applied only when `isThreadPanel` is set.

The overrides stay in those two modules and only on the drawer path; no other call site copies them.

## Consequences
These two drawer elements can drift when core restyles `Button`'s icon slot or `Card`'s surface, so
a core change to either is checked against the drawers (and the Inbox) in both themes. When core
ships the variants, the drawers and the Inbox's `FOOTER_BUTTON_CLASS` move to them and this record is
superseded.
