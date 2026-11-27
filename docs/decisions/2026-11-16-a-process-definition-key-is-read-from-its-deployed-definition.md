# A workflow's process-definition key is read from its deployed definition, never parsed from its ID

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** Vamsi-klu
- **Guard:** `WorkflowHandlerProcessDefinitionKeyTest`; `WorkflowDefinitionResourceIT#test_longWorkflowNameKeepsItsApprovalTaskAndCompletesItsRun` and `#test_longPeriodicWorkflowNameRecordsItsRunAndBindsItsTask`; reviewer
- **Related:** open-metadata/OpenMetadata#36148

## Context
Flowable 7.2 builds a process-definition ID as `key:version:generatedId` only while that fits the
64-character `ACT_RE_PROCDEF.ID_` column (`BpmnDeployer.getIdForNewProcessDefinition`); a longer
one is the bare generated ID. The process keys are the workflow name, `<name>Trigger` and
`<name>Trigger-<entityType>`, and names may be 256 characters, so splitting the ID on `:` read a
long-named workflow's key as a number such as `6308`. Its trigger was then not recognized as an
OpenMetadata trigger, the run got no business key or WorkflowInstance row, and its approval task
was adopted by the default lifecycle. The threshold moves as the generated ID and the version grow,
so a name that works today can stop working after later deployments.

## Decision
Code that needs the key of a process definition calls
`WorkflowHandler.getProcessDefinitionKeyFromId`, which asks `RepositoryService.getProcessDefinition`
for the deployed definition (served from Flowable's deployment cache). Only when the engine is not
running or the definition cannot be read (an unknown ID, or a database error) does it fall back to
the part of the ID before the first `:`, which is the whole bare generated ID when the ID embeds
no key. It returns null for a null ID and never throws, because most callers use it while logging
from a `catch`. Nothing else parses a process-definition ID.

## Consequences
Workflow-name length no longer changes run identity or lifecycle ownership, and keys containing `:`
are no longer truncated. Each call is one Flowable command, normally a cache hit. Revisit only if
Flowable exposes the key on `DelegateExecution`/`DelegateTask`, which would make the lookup
unnecessary.
