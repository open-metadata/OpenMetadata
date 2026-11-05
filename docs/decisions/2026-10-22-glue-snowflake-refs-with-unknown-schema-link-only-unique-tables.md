# A Glue script's Snowflake ref with an unknown schema links only a unique table

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** GluePipeline connector maintainers (review of #35733)
- **Guard:** `test_glue_snowflake_lineage.py` (`test_unknown_schema_is_left_to_the_resolver`,
  `test_unknown_schema_in_the_options_dict`, `test_branches_keep_the_values_they_agree_on`,
  `test_branches_that_disagree_on_the_table_are_not_linked`,
  `test_same_table_in_two_services_is_ambiguous`)
- **Related:** #35464, #35732, #35733

## Context

Glue job scripts read and write Snowflake through options the parser can only partly know: the
schema or database is often a job parameter (`args["SCHEMA"]`), comes from a dict built at runtime,
or differs between branches of an `if`. Two answers are possible for such a ref: emit nothing, or
emit the table with the unknown part unset and let the resolver decide. #35464 shipped the second;
a commit on #35733 switched to the first, which dropped lineage `main` finds for the common
job-parameter pattern, and review switched it back. This is the third iteration on the trade-off.

The parser also merges every assignment that may be in effect at a read (if/else branches, loop
back edges, a global read from a function), which needs a bound.

## Decision

- A Snowflake ref whose database or schema cannot be known statically is emitted with that part
  unset. A ref is only dropped when its table is unknown.
- The resolver (`GluepipelineSource._resolve_snowflake_ref`) tries `(database, schema)`, then less
  specific lookups, across every service in `dbServiceNames`. The first attempt with any match
  decides: one match links, several mean no lineage (a less specific attempt would only match
  more), none tries the next attempt.
- Assignments that may reach one read are merged key by key: a key they all set to the same value
  is known, any other is unknown. A read reached by more than 16 assignments (`MAX_CANDIDATES`)
  is unknown; real scripts reach a handful, and the cap only bounds the work on generated code.

## Consequences

- A job whose schema is a parameter still gets lineage when its table name is unique, as on
  `main`. When the name is not unique, it gets none rather than a guess.
- Unknown parts never fall back to the script-wide `sfDatabase` / `sfSchema` value: that fallback
  applies only to a block that does not set the key at all.
- Revisit if lineage to a same-named table in the wrong schema is reported: the alternative is to
  drop refs with an unknown schema, at the cost of the job-parameter pattern.
