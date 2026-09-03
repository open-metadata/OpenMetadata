# Table → TableV2

Sweep guide for replacing the legacy `common/Table/Table` (AntD) with
`common/Table/TableV2` (`@openmetadata/ui-core-components`). This is the review
contract for every call-site PR in the sweep.

Written from a parity suite that drives **both** wrappers through the same specs
(`src/components/common/Table/__tests__/`). Where the table below says a prop
works, there is a spec proving it works identically on both.

## Prop support

### Works — no call-site change needed

`columns` (`dataIndex`, `key`, `title`, `render`, `width`, `ellipsis`, `fixed`,
`sorter`, `sortOrder`, `sortDirections`, `filters`, `filterIcon`,
`filterDropdown`, `onFilter`, `onCell`) · `dataSource` · `rowKey` · `loading`
(boolean and `{ spinning }`) · `locale.emptyText` · `pagination`
(`pageSize`, `hideOnSinglePage`, `showSizeChanger`, `pageSizeOptions`,
`onShowSizeChange`) · `rowSelection` (`type`, `selectedRowKeys`, `onChange`,
`getCheckboxProps`) · `expandable` (`expandedRowKeys`, `onExpand`,
`rowExpandable`, `expandedRowRender`, `expandIcon`) · `indentSize` · `onRow`
(`onClick`, `onDoubleClick`, drag handlers) · `onChange` · `rowClassName` ·
`footer` · `scroll` · `size` · plus the wrapper's own `containerClassName`,
`searchProps`, `customPaginationProps`, `defaultVisibleColumns`,
`staticVisibleColumns`, `extraTableFilters`, `entityType`, `cellClassName`.

### Blocked — the call site must change

| Prop | Why | Do instead |
|---|---|---|
| `summary` | React Aria's collection builder discards any table child that is not a Header or Body, so a `tfoot` never reaches the DOM. Drawn outside the table it would not align with the columns | render the total above the table, or add a summary slot to `ui-core-components` first |
| `components` | no equivalent for custom row/cell renderers | `dragAndDropHooks` for drag rows; a column `render` for custom cells |

Both are **omitted from `TableV2Props`**, so a call site passing them fails to
compile rather than rendering a table that quietly lost a feature.

### Changed contract

| Prop | Change |
|---|---|
| `customPaginationProps` | now **requires** `pagination={false}` alongside it — the parent owns paging and has already fetched exactly this page, so slicing again would drop rows |
| `size` | AntD `small` → core `compact`, `large` → `md`, unset → `sm`. Note that AntD tables not inside a `TableCard` were previously rendered at `md` because the core `size` prop was inert |

## Test selector contract

Do not select on `.ant-table*`. These hold on **both** wrappers, so a test
rewritten now keeps passing through the sweep:

| Target | Selector | Notes |
|---|---|---|
| row | `[data-row-key]` | AntD's rc-table emits this natively |
| cell | `td` | |
| header row | `thead tr` | |
| expander | `[data-testid="expand-icon"]` | both wrappers emit it |
| selection control | `input[type="checkbox"]` | radio in single-selection mode |
| toolbar | `[data-testid="table-toolbar"]` | TableV2 only |
| column customize | `[data-testid="column-dropdown"]` | both |
| pager | `[data-testid="pagination"]` | via `NextPrevious` |

No shared hook exists for these — migrate them in the sweep PR that moves the page:

| Target | Legacy | TableV2 |
|---|---|---|
| tree depth | `.ant-table-row-level-N` | `data-level` |
| filter trigger | `.ant-table-filter-trigger` | `[data-testid="filter-trigger"]` |
| filter dropdown | `.ant-table-filter-dropdown` | `[data-testid="filter-dropdown"]` |

## Per-page checklist

Exercise on the migrated page, not just in unit tests: sorting on every sortable
column (both directions and off) · column resize and its persistence ·
pagination including page-size change and the last page after filtering · row
selection including disabled rows and select-all · expand/collapse at every
nesting depth · column show/hide and drag reorder in the customize dropdown ·
fixed columns while horizontally scrolled · column filters · empty, loading and
error states · dark mode · keyboard navigation and the focus ring.

## Gotchas found during the parity work

- **React Aria strips a row's `onClick`** unless the row is interactive. TableV2
  handles this internally; do not add your own `onAction` to compensate.
- **`ts-jest` does not fail on a missing export here** — a passing jest run is
  not a typecheck. Use `tsc --noEmit`, and compare the error count against the
  branch point: `main` is not clean (573 errors at time of writing).
- **`openmetadata-ui` typechecks against `ui-core-components/dist`,** not its
  source. A core change is invisible until that package is rebuilt.
