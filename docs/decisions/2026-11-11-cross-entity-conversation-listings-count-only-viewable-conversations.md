# Cross-entity conversation listings count only conversations the caller may view

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial)
- **Deciders:** backend
- **Guard:** `ConversationResourceIT.testMentionsListAndCountOnlyConversationsAboutViewableEntities`,
  `ConversationRepositoryTest.aListTotalIsRecountedWheneverItCountsMoreThanThePageShows`,
  `ConversationRepositoryTest.aRecountChecksEntitiesOnlyOfTypesARuleCouldHide`
- **Related:** open-metadata/openmetadata-collate#7964;
  ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read;
  ADR:2026-11-03-context-center-listings-show-and-count-only-what-the-caller-may-read

## Context

A conversation listing that spans entities (`filterType` mentions, follows or owner, with no
`entityLink`) keeps only conversations about entities the caller may view. Clients read its
`paging.total` as a count: the inbox badge asks for one row and shows the total. A total over every
stored row disagrees with what the list shows. A total reduced by the rows hidden on the returned
page changes from page to page, and a page that hides nothing itself still counts rows hidden on
the others.

## Decision

- For an admin, and for a listing scoped by `entityLink`, `paging.total` counts every stored row.
- An entity is checked only if its type is one a rule could hide from the caller
  (`RowDecisionGate.mayDiffer` for ViewBasic); conversations about other types are shown and
  counted as they are. The page and its total use the same rule.
- For anyone else, the stored total stands only when the page shows that many rows. If not, the rows under
  the same filter are counted per entity type (one `GROUP BY entityType`). Types no rule can hide
  count as they are. Only for the rest are rows counted per entity (one `GROUP BY entityType,
  entityId` limited to those types), each entity checked once with `ViewPermissionFilter`. At most
  `MAX_VIEWABLE_COUNT_ENTITIES` (10,000) entities are checked; past that the total is a lower
  bound. The total is never less than the page.
- Paging cursors are unchanged and still walk every row. Pages are not refilled, so one can come
  back shorter than the limit.

## Consequences

The badge, the list and every page report the same count. For a caller no rule restricts, a page
that shows fewer rows than the stored total costs one aggregate query and loads no entity. For a
caller under a deny rule or a conditional grant, it also costs a second aggregate query and one
batched authorization load per hideable type, of up to 10,000 entities, so the cost follows the
distinct entities of those types, not the conversations. Entity listings keep counting
every row (ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read); conversations differ
because their clients display the total as a count. Revisit if listings move their view conditions
into SQL.
