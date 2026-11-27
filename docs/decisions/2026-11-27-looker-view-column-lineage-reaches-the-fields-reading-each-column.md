# A Looker view's SQL output column reaches the data model only through the LookML fields that read it

- **Status:** Accepted
- **Revisions:** v1 2026-11-27 (initial)
- **Deciders:** Looker connector maintainers (PR #38659)
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_looker_issue_regressions.py`
  (`test_derived_view_column_lineage_lands_on_the_fields_reading_each_column`,
  `test_derived_view_keeps_the_table_edge_when_no_field_column_resolves`,
  `test_view_reading_a_derived_views_table_maps_columns_to_its_own_fields`,
  `test_chained_derived_view_maps_the_upstream_sql_columns_to_its_own_fields`)
- **Related:** #38583, #38325, PR #38512, `REVIEW.md` "Lineage does not guess"

## Context

A Looker view's `DashboardDataModel` has one column per LookML field (dimension, dimension group, measure), named
after the field. For a derived-table view, and for a view whose `sql_table_name` is another derived view's
`SQL_TABLE_NAME`, column lineage comes from parsing the SQL, which names the columns the SQL outputs, not the
fields. Matching the SQL output column to a data model column by name or label dropped the edge whenever a field
renamed its column, and for every dimension group and measure. Where a field's name or label happened to equal a
different output column, it linked the wrong column.

## Decision

- An SQL output column is linked to every LookML field of the view whose `sql` reads it, through `${TABLE}.<column>`
  or through `${other_field}` resolved recursively (`_extract_column_lineage`). Matching ignores case.
- A field whose `sql` names a column is never also matched by its own name or label.
- A field with no extractable column reference (no `sql`, a bare column, Liquid only, `${view.field}`) keeps the match
  on its own name, as Looker reads a field without `sql` as `${TABLE}.<field>`.
- `SELECT *`, a field reading a column the SQL does not output, and an output column no field reads get no column
  edge. The table edge is kept.
- A view whose `sql_table_name` is `${derived.SQL_TABLE_NAME}`, and a chained derived view, map columns through their
  own fields, not the upstream view's.

## Consequences

- Renamed dimensions, dimension groups and measures of derived views get column lineage; links that only existed
  because a name coincided are no longer emitted.
- View lineage is merged into the stored edge, so column links an earlier run stored are not removed by this rule.
  Clearing them needs view lineage to go through `yield_lineage_request` so `overrideLineage` applies.
- The deferred-view path (`build_lineage_for_unparsed_views`, #38325) still matches by name; reviving it should pass
  the view so this rule applies there too.
