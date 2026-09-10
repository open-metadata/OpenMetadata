# Unified onboarding and intake forms

An IntakeForm configures creation fields and onboarding gates for one of `dataProduct`,
`domain`, `glossaryTerm`, or `metric`. Administrators use the existing
`/settings/governance/intake-forms` page. Producers resume work from an asset's checklist or
the `/onboarding` board.

## Guided experience

The combined editor has a stage rail, ordered check cards, assignment and requirement
summaries, and workflow settings. Its producer preview uses the same journey as enrolled
assets, with isolated values, role switching, and clearly marked simulated approval and
rejection. Preview writes never create assets or tasks.

The asset journey focuses one check at a time. Producers save through the existing field
editors, use Back to revisit work, and can skip optional or recommended checks without
marking them complete. Required progress separates personal work, work assigned to others,
and unresolved assignments. Handoff panels show assignees, task links, workflow state, and
execution evidence. Saved progress survives reload; unsaved edits require confirmation
before switching checks, collapsing the journey, advancing, or navigating away, including
browser Back and Forward. Field loads and failed saves can be retried. If another editor has
changed the same field, producers review its latest saved value and explicitly keep their
edits or use that saved value before saving again. Version preconditions require read access alongside each field's
existing edit permission, so delegated editors do not need EditAll permission to save.

The board shows required-check progress bars, assignee avatars, waiting checks, and localized
time in stage. Its existing type, stage, domain, and assignee filters and pagination remain
available and survive reload and Back navigation. Failed board requests clear obsolete rows
and offer Refresh. Creation forms explain queued checks, assignees, and workflows at later
stages. Ordinary viewers can inspect progress but cannot edit restricted fields or decide
another person's approval task. Approval actions use the task's ResolveTask permission,
including workflow approvals. Repeating a transition request while review is pending preserves
the current stage and reuses the active task; changed review inputs can request a new attempt.

## Gates and requirements

The lifecycle is Creation → Draft → In Review → Approved → Deprecated. Creation checks run
before the entity is created. Draft checks gate entry to In Review; In Review checks gate
approval. Approved completes onboarding. Approved and Deprecated have no configurable checks.

`formFields` stores each field's inclusion, required/recommended status, label, and validation
message. `onboarding.gates[].steps` orders checks and references those fields by `fieldPath`.
Unscheduled intake fields retain their Creation requirements. Schema-required fields cannot
move out of Creation or become conditional. Older payloads can keep using `requiredFields`;
updates omitting `onboarding` preserve the existing gates.

Field checks read actual entity values, including hydrated relationships and `extension`
custom properties. A step can require presence, `rules.minLength`, or `rules.minItems`.
Conditions are combined with AND and support `present`, `equals`, and `contains` on native
or extension paths. `contains` accepts relationship IDs/FQNs and tag FQNs. Missing required
checks block the entire gate regardless of who is assigned to complete them. Later fields
can be saved incrementally; requirements from completed gates remain enforced on writes.
PUT updates load the persisted asset before checking its pinned requirements and preserve an
omitted status. Bulk creation and import updates run the same gate validation before storage.

## Workflow approvals

Approval steps reference a deployed, active WorkflowDefinition. Compatible task workflows
use the manual `noOp` trigger, contain `userApprovalTask`, and do not contain an entity
attribute setter. The workflow supplies reviewers, assignment strategy, and approval threshold.
`RequestApprovalTaskWorkflow` is a compatible starting point for a custom workflow.

Task V2 resolution records an onboarding decision only when Flowable has completed the matching
execution. Completing one approval does not set the entity to Approved. All required field and
approval checks must pass through the same repository validation used by REST and workflow
status changes. Existing automatic approval triggers skip enrolled assets and keep their
behavior for other assets.

Bindings correlate instance, gate, step, and attempt. Concurrent retries reuse active tasks.
Rejection or failed execution permits resubmission. Before a gate advances, changes to checked
fields, condition inputs, or relevant responsibilities invalidate its approvals. Completed
onboarding retains its recorded approval evidence when metadata is maintained afterward.

## API

All paths below are relative to `/api/v1/governance/onboarding`.

| Method and path | Behavior |
| --- | --- |
| `POST /evaluate` | Evaluate `{entityType, entity, stage}` draft values using the published configuration. Requires Create permission. |
| `GET /{entityType}/{id}` | Read persisted enrollment and freshly evaluated checks. Requires ViewAll permission. |
| `POST /{entityType}/{id}/transition` | Request `{expectedVersion, targetStatus, retry}`. Requires EditAll permission. A stale entity version returns 409. A blocked request returns progress with `blockingSteps`, messages, and linked task IDs. |
| `GET /` | Cursor-paginated board with `entityType`, `stage`, `domain`, `assignee`, `after`, and `limit` filters. Rows respect entity view permissions. |
| `GET /backfill/{entityType}` | Administrator-only enrollment counts, cursor, completion, and failures. |
| `POST /backfill/{entityType}/retry` | Administrator-only resumable rescan; existing instances and active task bindings are retained. |

No API accepts checklist completion from a client. Entity edits and task decisions continue to
use their existing APIs and authorization.

## Enrollment and rollout

Native migrations in `bootstrap/sql/migrations/native/2.1.0/` create indexed instance,
task-binding, and backfill tables for MySQL and PostgreSQL. Apply native migrations before
running the updated server.

Enabling staged onboarding enrolls new assets and starts a background backfill in pages of 50.
Draft and Unprocessed assets are eligible; enrolled Unprocessed assets normalize to Draft.
Existing In Review, Approved, and Deprecated assets and their tasks are left in their current
processes. Backfilled assets can save partial Creation work until those checks first pass.

Each instance stores its configuration snapshot and version. Publishing a revision affects
new enrollments. Disabling onboarding pauses active transitions; re-enabling resumes them.
Backfill cursors and failures survive restart, and a database lease prevents concurrent workers
from processing the same page. The worker also recovers outstanding task starts after restart.

Integration coverage lives in `OnboardingResourceIT` and `IntakeFormResourceIT`. Browser journeys
live in `playwright/e2e/Pages/Onboarding*.spec.ts` and the existing `IntakeForm.spec.ts`. The four
main journeys configure and create each entity through the UI, delegate metadata work, resume
saved progress, complete real workflow approvals, and monitor the board. Focused specifications
cover creation requirements, editor permissions, conditional custom properties, workflow
thresholds and failures, rejection and revision, concurrent submissions, failed requests,
version conflicts, configuration pinning, backfill exclusions, and keyboard navigation.
The IntakeForm project runs with one worker because the configurations are shared per entity type.
