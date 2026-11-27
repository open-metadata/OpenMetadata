# Governance workflow expression references are bare variable names

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial)
- **Deciders:** TeddyCr
- **Guard:** `WorkflowExpressionValidatorTest` and
  `WorkflowDefinitionRepositoryExpressionInterpolationTest` (unit); write-time validation always
  runs through `WorkflowDefinitionRepository.prepare`, and the node builders fail closed at BPMN
  build time.
- **Related:** PR #36138

## Context

The governance-workflow BPMN builders interpolate definition-authored strings into Flowable
expressions and into generated references: a conditional edge builds
`${<from>_result == '<condition>'}`, an approval node's decision flows build
`${<node>_result == ...}`, and an expiry timer builds `${<variable>}`. Until now the character set
of those values was constrained only on the conditional-edge values
(`WorkflowExpressionValidator.checkEdgeExpressionSafety`); timers, and node names on flows that
exist regardless of edge conditionality, were unconstrained `entityName`/free-text strings. A
definition that put non-reference characters there deployed an expression the author did not
intend.

## Decision

Every string the governance-workflow BPMN builders use where a JUEL variable reference must stand
matches `^[A-Za-z0-9_]+$`:

- the `from` of a conditional edge and the name of every `userApprovalTask` and
  `createAndRunIngestionPipelineTask` node (both prefix generated process-variable references);
- `expiryTimer.durationVariable` and `expiryTimer.dateVariable`, which alone must additionally
  start with a letter or underscore and must not be a JUEL reserved word (`true`, `false`, `null`,
  `empty`, `and`, `or`, `not`, `div`, `mod`, `instanceof`, `eq`, `ne`, `lt`, `le`, `gt`, `ge`),
  because the timer interpolates the value in expression code position and nothing else, where
  JUEL would otherwise read `123` as a number or `true` as a literal instead of a variable lookup.

It is enforced at write time (`WorkflowDefinitionRepository.validateExpressionInterpolation` returns
a 400 on create/PUT/PATCH), at BPMN build time (the node builders throw — a definition that predates
the validation fails closed at redeploy), and in the schema (`userApprovalTask.json` pattern on the
timer variables). Values interpolated as quoted string literals (edge conditions) or as literal
field extensions keep their existing, broader contracts; node names of kinds that never reach an
expression keep the `entityName` charset.

This is a deliberate tightening of accepted input: definitions saved earlier with names outside the
charset get a 400 on their next full edit, and fail at redeploy until renamed. A future node kind
whose name prefixes generated process variables must join
`NODE_NAMES_INTERPOLATED_INTO_EXPRESSIONS`; a future builder that interpolates a new definition
field in code position must validate it through `WorkflowExpressionValidator`.

## Consequences

Deployed BPMN expressions are always built from validated identifiers, so a definition that passes
write-time validation cannot express anything but the references its author named. Definition
authors lose the ability to use spaces, dots or operators in node names of the two interpolated
node kinds — display names remain the place for human-readable labels. Reviewers adding node kinds
must keep the registry (`NODE_NAMES_INTERPOLATED_INTO_EXPRESSIONS`) in sync with any builder that
names a process variable after the node.