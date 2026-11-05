# A workflow definition's graph and filter are EditAll fields, and filter entries are strings

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** yan-3005
- **Guard:** `WorkflowDefinitionResourceIT#test_patchingTheWorkflowGraphNeedsEditAll`, `WorkflowDefinitionResourceIT#test_triggerFilterEntriesMustBeStrings`, `TriggerEntityFilterTest`, `WorkflowTriggerFiltersTest`
- **Related:** `WorkflowDefinitionResource`, `WorkflowDefinitionRepository`, `TriggerEntityFilter`

## Context

A JSON Patch is authorized by the first segment of its path that maps to an operation. A workflow
definition's `config`, `trigger`, `nodes` and `edges` mapped to none, so a key nested under them, such
as a `description`, decided the operation. Every stored change to these fields redeploys the
workflow. The trigger filter schema declares its entries as JSON Logic strings, but nothing enforced
it, and readers converted the filter to a string map.

## Decision

- `config`, `trigger`, `nodes` and `edges` of a workflow definition are edited with `EditAll`. The
  top-level `description` keeps `EditDescription`.
- Trigger filter entries are JSON Logic strings. A definition with any other entry is refused when
  written. A stored entry of another shape is read as no filter, so the entity type it names is not
  excluded.
- A definition whose BPMN cannot be built is refused when written, and deploy and redeploy build the
  BPMN before removing anything already deployed.

## Consequences

- Editing a workflow's structure needs the rights its owner or an admin holds; the description stays
  open to the same users as before.
- One malformed definition cannot stop other workflows from resolving their filters.
