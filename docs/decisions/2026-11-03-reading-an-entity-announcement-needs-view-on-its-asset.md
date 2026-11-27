# Reading an entity announcement needs view access to its asset

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** @sonika-shah
- **Guard:** `FeedAccessAuthzIT#readAnnouncement_callerDeniedViewOnTarget_forbidden`, `FeedAccessAuthzIT#listAnnouncements_hidesUnviewableAssets`, `FeedAccessAuthzIT#readAnnouncement_afterAssetRename_checksAsset`, `FeedAccessAuthzIT#listAnnouncements_totalCountsOnlyViewable`, `WebsocketNotificationHandlerTest`, `McpContextMemoryVisibilityIT#plainRead_deniesAnAnnouncementOnATableTheCallerCannotView`
- **Related:** ADR:2026-10-12-system-announcements-are-managed-in-settings-notifications, open-metadata/OpenMetadata#33633

## Context

An announcement with an `entityLink` is shown on that asset and is about it. The activity and
conversation reads already require `ViewBasic` on the entity they are about.

## Decision

`GET /v1/announcements/{id}`, `/name/{fqn}`, `/{id}/versions` and `/{id}/versions/{version}` require
`ViewBasic` on the linked entity. An unscoped list leaves out the announcements whose linked entity the
caller may not view, checked once per entity type through `ViewPermissionFilter`; admins skip the
check. A list narrowed with `entityLink` also requires `ViewBasic` on the entity that link names.

The linked entity is read from the `entity --MENTIONED_IN--> announcement` edge written at creation
(`AnnouncementRepository.getLinkedEntities`), not from the stored `entityLink`: the edge follows the
entity by id, while the link keeps the name a rename leaves behind. An entity announcement with no such
edge is readable by admins only. System announcements (no `entityLink`) are not affected.

A write to an existing announcement (PATCH, PUT of an existing name, DELETE, restore) answers with
it, so it needs the same access first.

`AnnouncementVisibility` holds the rule, and the REST and MCP reads call it: the REST resource and
the MCP entity read and patch (`CommonUtils.readEntityForCaller`, `CommonUtils.enforceEntityVisibility`).
The live websocket broadcast of a new announcement reaches every session, so for an announcement on
an asset it carries only the id and the client reads the rest through the guarded GET; a system
announcement is still broadcast whole.

## Consequences

A list page can hold fewer rows than `limit`; its cursors are unchanged, so a client keeps paging.
On the first page (no `before`/`after`), `paging.total` counts only the announcements the caller may
view, so a badge built from it matches what the caller can load. For a non-admin that reads the
filter's matches in batches of 500 and checks at most the first 10,000; matches past that cap are
counted unchecked, so the total can only overstate. Later pages only subtract what they hid, so paging
stays bounded by `limit`. Admins skip all of it. Resolving the linked entities costs one batched
relationship read per page or batch.
