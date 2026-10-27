# A negated condition on a list field is stored as a negation of the whole list

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `openmetadata-ui/src/main/resources/ui/src/utils/queryBuilder/jsonLogicNegation.test.ts`;
  `playwright/e2e/Features/Workflows/WorkflowCheckConditionNegation.spec.ts`;
  `MigrationUtilTest` (v208), `NegatedListRuleMigrationIT`
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
keeps RAQB's shape. Nothing under an explicit `!` is rewritten, on save or by the migration: the
editor offers no NOT, so such a rule came through the API and its per-element meaning was meant. A NOT the editor cannot express as a row stays a negated group and is drawn with
a NOT badge, never dropped.

## Consequences
Anything that writes rules (API clients, seed data, Collate) should use the stored shapes above.
Rules stored before this record are rewritten once, by the 2.0.8 data migration
(`migration/utils/v208/MigrationUtil.java`): workflow check conditions and event trigger
filters (stored through the repository so each changed workflow is redeployed), data contract
semantics and the entity rules settings. From the upgrade on, a rule runs as its row reads; a rule
someone relied on in its old per-element meaning changes behaviour then, which the release notes
must say. The migration and the editor use the same rewrite, tested against one case table, so a
migrated rule saves back unchanged. Revisit if the engine gains list-level negated operators.
