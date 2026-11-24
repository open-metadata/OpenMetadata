# A Column Tags condition is stored as a some over columns of a some over tags

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial)
- **Deciders:** anuj-kumary
- **Guard:** `openmetadata-ui/src/main/resources/ui/src/utils/queryBuilder/jsonLogicColumnTags.test.ts`
- **Related:** #37018, ADR:2026-10-26-negated-list-conditions-are-stored-as-negated-some

## Context
The JSON Logic rule editor builds Column Tags as a `some` group keyed `columns.tags`, so it stored
`some(columns.tags, cond)`. `columns` is a list, and json-logic-java cannot follow a dotted `var`
through a list: it throws, and `RuleEngine.apply` returns `false`. Every Column Tags condition in a
workflow, trigger filter, data asset rule or data contract semantic never matched. The backend
evaluates rules as given, so the fix is in the shape the editor stores.

## Decision
A Column Tags row is stored as `some(columns, some(tags, cond))`, never with a `columns.tags` var.
Negated rows follow ADR:2026-10-26-negated-list-conditions-are-stored-as-negated-some around the
outer group: `!some(columns, some(tags, cond))`, "no column has a matching tag". The editor maps
between that and RAQB's `columns.tags` group at its save/load boundary
(`utils/queryBuilder/jsonLogicColumnTags.ts`): it expands after the negation pass on save and folds
back before it on load. Only that exact nested shape is folded back.

## Consequences
Rules stored with `columns.tags` before this change are not migrated: they load into the Column
Tags row as before, keep evaluating to `false`, and are rewritten when the condition is next edited.
Unlike the negation fix, which corrected rules that already fired with the wrong meaning, a
migration here would switch on conditions that have never fired, changing workflow routing on
upgrade without anyone reviewing it. Revisit if users need existing rules activated in place; a
migration would reuse the expand rewrite, as v208 did.
