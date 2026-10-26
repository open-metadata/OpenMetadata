# A negated condition on a list field is stored as a negation of the whole list

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `openmetadata-ui/src/main/resources/ui/src/utils/queryBuilder/jsonLogicNegation.test.ts`;
  `playwright/e2e/Features/Workflows/WorkflowCheckConditionNegation.spec.ts`
- **Related:** customer report on workflow tag rules (Collate issue 7854)

## Context
The JSON Logic rule editor (workflow check conditions and trigger filters, data asset rules, data
contract semantics) builds list fields such as Tags, Owners or Domains as a `some` group, and RAQB
negates the operator per element: "Tags Is Not X" became `some(tags, tagFQN != X)`, which the rule
engine (json-logic-java) reads as "has a tag other than X". An untagged asset failed it; one tagged
X and Y passed it. "Not In" (`some(!in)`) and "Is Not Set" (`some(== null)`) had the same flaw.

## Decision
Rules are stored in the shape the engine evaluates as the label reads, and the editor maps between
that and RAQB's shape at its save/load boundary (`utils/queryBuilder/jsonLogicNegation.ts`):

| Row | Stored |
|---|---|
| Is Not X | `!some(list, field == X)` |
| Not In [X] / Not Contains | `!some(list, in / contains)` |
| Is Not Set | `!some(list, field != null)` |

Only shapes the loader can turn back into a row are rewritten; any other negation inside a `some`
keeps RAQB's shape. A NOT the editor cannot express as a row stays a negated group and is drawn with
a NOT badge, never dropped.

## Consequences
Anything that writes rules (API clients, seed data, Collate) should use the stored shapes above.
Rules saved before this record keep their per-element meaning until re-saved, and load as the same
row as the corrected shape. Revisit if the engine gains list-level negated operators.
