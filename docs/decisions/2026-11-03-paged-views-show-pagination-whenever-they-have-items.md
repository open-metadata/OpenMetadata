# A paged view shows its pagination control whenever it has items

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** UI maintainers
- **Guard:** `PaginationUtils.test.ts` (`shouldShowPager`), `usePaging.test.ts` and `useCursorPagedList.test.ts`
- **Related:** ADR:2026-10-13-ui-page-sizes-lists-15-25-50-grids-12-24-48, supersedes ADR:2026-10-31-paged-settings-lists-keep-pagination-at-non-default-page-size

## Context
Paged views hid the pagination bar when every item fit on one page. The size picker lives in that
bar, so a user who picked a size that showed everything on one page (12 cards on a grid of 10
apps) lost the bar and could not change the size again. ADR:2026-10-31-paged-settings-lists-keep-pagination-at-non-default-page-size
kept the bar only while the size differed from a panel's default, which still hid it at the
default, and each page applied its own variant of the rule.

## Decision
A paged view shows its pagination control whenever the page has at least one item, and hides it
only when the page is empty. This holds for every paged view: lists, tables and card grids,
including a single page of items. The rule lives in `shouldShowPager` (`utils/PaginationUtils.ts`)
for views that hold their items, and in `usePaging` (a total above 0, or a next or previous
cursor) for views that only know the total. `TableV2` client paging and `PaginationComponent` show
the control on a single page; `hideOnSinglePage` remains an explicit opt-out.

## Consequences
The page size can always be changed while there is anything to show, and every paged view
behaves the same way. A single page of items shows a pager with one page, which is the accepted
cost. An empty page shows no pager, so a user on an emptied later page goes back through the
view's filters or by reopening it. Revisit only if the page-size control moves out of the
pagination bar.
