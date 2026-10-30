# Policy conditions are rewritten through the SpEL AST, and a call naming only deleted entities becomes false

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `PolicyConditionUpdaterTest`, `OpenSearchRBACConditionEvaluatorTest#falseLiteralMakesAnAllowRuleMatchNothing`, `PolicyResourceIT#test_deletingTheOnlyTagLeavesAConditionThatMatchesNothing`
- **Related:** #26942

## Context

`PolicyConditionUpdater` rewrites every policy condition when a tag, classification, glossary,
glossary term, container or service is renamed, and when one of these, a role or a team is deleted.
Entity names may contain `)`, `,` and `'`, so where a string literal ends is something only the
SpEL parser can say reliably. On delete, the rewrite has to decide what a call becomes once some or
all of the entities it names are gone.

## Decision

1. Conditions are rewritten through the SpEL AST (`SpelExpressionParser.parseRaw`). Only calls of
   the target functions whose arguments are all string literals are rewritten, and only their own
   text span changes. A call that is not touched comes back byte for byte. A condition that does not
   parse is left unchanged.
2. On delete, a call keeps the arguments that survive. A call with no surviving argument, and a
   `matchAllTags` call that lost any argument, is replaced by `false`: the value the call evaluates
   to once those entities are gone. No boolean folding is applied, so
   `isOwner() && matchAnyTag('X')` becomes `isOwner() && false`.
3. A rewrite to `false` happens only where the deleted entity can no longer match:
   - tag and glossary term delete (soft or hard) — `postDelete` removes their labels from assets,
     including certification labels, which are `tag_usage` rows read by `matchAnyCertification`;
   - role and team delete — soft-deleted roles and teams drop out of user membership
     (`findTo` reads `NON_DELETED`, `TeamHierarchyResolver` drops deleted references);
   - service delete — only on hard delete, which removes the service's assets;
   - classification and glossary delete — only on hard delete. A soft delete cascades to the child
     tags or terms without removing their labels, so the condition is left as written.
4. Search RBAC (`RBACConditionEvaluator`) reads a `false` literal as match-nothing, the same value
   the in-memory evaluator gives it. A literal otherwise contributes no clause, which the collector
   reads as match-all.

## Consequences

- A rename never changes a condition's structure, and a delete never makes a condition match more
  than it did.
- A rule that named a deleted entity stops applying, Allow and Deny alike; it can no longer match
  anything.
- Conditions such as `isOwner() && false` stay visible in the policy editor. They read as a rule
  that no longer applies, which is accurate; folding them away would hide that something was deleted.
- Conditions rewritten by earlier versions are not revisited.
- A computed (non-literal) argument is never treated as an entity name; such calls are not rewritten.
