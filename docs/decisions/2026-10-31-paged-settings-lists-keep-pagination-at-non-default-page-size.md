# A paged settings list keeps its pagination control visible at a non-default page size

- **Status:** Superseded by ADR:2026-11-03-paged-views-show-pagination-whenever-they-have-items
- **Revisions:** v1 2026-10-31 (initial) · v2 2026-11-03 (the default is the first step of the panel's scale)
- **Deciders:** Settings modal maintainers
- **Guard:** `AccessControlRolesPanel.test.tsx` ("keeps pagination at a non-default page size so it can be switched back") and the same-named case in `AccessControlAuditLogsPanel.test.tsx`
- **Related:** open-metadata/OpenMetadata#36707, open-metadata/openmetadata-collate#8065

## Context
The Settings modal list panels hid the pagination bar whenever every row fit on one page. A user
who picked a larger page size (for example 25) on a list with fewer rows lost the bar, and with it
the page-size control, so the size could not be switched back. `usePaging` already keeps the bar
for a non-default size; the panels that compute visibility themselves had dropped that clause.

## Decision
A paged settings list shows its pagination control when any of these hold: a previous or next
cursor exists, the total exceeds the page size, or **the selected page size differs from that
panel's default**. The default is `PAGE_SIZE_BASE` for Bots, Roles, Policies and Personas, and
`PAGE_SIZE_MEDIUM` for the Audit Log. New paged settings panels apply the same rule.

## Consequences
The page-size control can always be returned to the default. A single-page list at a non-default
size shows a pager with one page, which is the accepted cost. Revisit only if the page-size
control moves out of the pagination bar.

## Amendment
v2 (2026-11-03): a panel's default page size is the first step of its scale
(ADR:2026-10-13-ui-page-sizes-lists-15-25-50-grids-12-24-48): `PAGE_SIZE_BASE` (15) for Bots,
Roles, Policies and the Audit Log, which are lists, and `GRID_PAGE_SIZE_BASE` (12) for Personas,
which pages its cards on the grid scale. Each panel starts from the user's saved size on that
scale, so the Audit Log no longer has a default of its own.

