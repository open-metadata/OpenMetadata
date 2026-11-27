# An Omni semantic-view topic reads its semantic view, and its inline views are data models

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** Omni connector maintainers
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_omni.py` (`test_parse_model_yaml_semantic_view_topic`,
  `test_parse_model_yaml_standalone_view_wins_over_inline_view`,
  `test_parse_model_yaml_inline_override_without_table_is_not_a_data_model`,
  `test_parse_model_yaml_inline_view_shared_by_two_topics_is_one_data_model`,
  `test_tile_reference_to_a_replaced_inline_view_resolves_to_the_view_file`,
  `test_tile_reference_to_a_replaced_inline_view_resolves_to_a_topic_of_the_same_name`,
  `test_parse_model_yaml_malformed_inline_view_is_skipped_alone`, `test_semantic_view_topic_lineage`)
- **Related:** issue #38320

## Context
Omni generates a topic from a Snowflake semantic view as one `.topic` file carrying `semantic_view: DB.SCHEMA.NAME`
and a `views` map of view definitions, each with its own `schema` and `table_name`. The model YAML has no `.view` file
for those views and the topic has no `base_view`. An ordinary topic can also carry a `views` map, whose entries
override fields of views defined elsewhere and usually name no table.

## Decision
- A topic with `semantic_view` takes its database, schema and table from that value. Its upstream is the semantic
  view's Table entity, searched with that database. A one- or two-part value fills the name, then the schema.
- Its columns are the fields of its inline views, named `<view>.<field>` as Omni references them.
- An inline view with a table of its own is one data model, parsed like a `.view` file, whose upstream is its table.
- An inline entry without a table is an override and is not a data model.
- A `.view` file wins over an inline view whose name matches it in any reference form, and then also answers to the
  inline name, so a tile that references either resolves to it. If a curated topic takes that view file's name, the
  topic answers to the inline name instead. Of two inline views with the same name, the first in
  file order wins.
- An inline view that cannot be parsed is skipped with a warning; the rest of the model is still ingested.

## Consequences
Dashboard tiles that reference an inline view's fields link to that view's data model. An override never shadows or
blanks the view it overrides. Column-level lineage from the semantic view is not drawn. If Omni starts emitting `.view`
files for semantic-view topics, those files take over and the inline copies are dropped.
