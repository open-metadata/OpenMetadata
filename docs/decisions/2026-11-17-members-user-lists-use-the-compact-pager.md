# Members user lists use the compact prev/next pager

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Rohit Jain (settings modal UI review)
- **Guard:** `MembersUsersPanel.test.tsx` (Previous uses the shown page's `before`; a newer page
  is never overwritten by an older response); `ProfileMembers.spec.ts` ("Should page the Admins
  list with Next and Previous", "Should go back a page with the before cursor of the page shown")
- **Related:** ADR:2026-10-16-cursor-paged-lists-jump-by-walking, open-metadata/OpenMetadata#37904

## Context
Members › Users, Admins and Online Users showed the full pager (page input, numbered pages). The
Teams list in the same modal shows the compact one (`< Page 1 of N >` and records), and the review
asked for one pager across Members. These lists are cursor-paged and can run to hundreds of
users, which is the case ADR:2026-10-16-cursor-paged-lists-jump-by-walking says the walk does not
fit: a jump to page 50 costs 49 requests.

## Decision
- Users, Admins and Online Users render `PaginationCardWithControls` with `minimal`: Previous,
  Next, `Page X of Y` and the records picker. No numbered pages, no page input.
- Previous uses the shown page's `before`; Next uses its `after`. `useCursorPageJump` stays: a
  second Next pressed while a page is still loading walks one page with `after`, and that walk
  asks for cursors only (no row `fields`).
- A deep link or reload with a page number starts at page 1.

## Consequences
Members lists cost one request per step and never walk far. Reaching a far page means searching
instead. The walking record still governs Applications and Personas. Revisit if the user list
gains an offset parameter, at which point numbered pages can return without a walk.
