# Onboarding Playbooks — bringing the implementation to the design

Branch: `harshach/onboarding-intake`. Design source: `Collate Onboarding Playbooks.html` mockup
plus three screens (Governance settings card, playbook manager, playbook editor).

## The core inversion

The design and the current code disagree about **who owns approvals and stage transitions**.

Today onboarding owns the state machine:

- `OnboardingEvaluator.stageFor(EntityStatus)` derives the stage from the entity's status, and
  `nextStatus(stage)` is a hardcoded `CREATION→DRAFT→IN_REVIEW→APPROVED→DEPRECATED` switch.
- `OnboardingTasks.recordDecision` intercepts task decisions by hooking `TaskRepository.resolveTask`.

The platform already has a canonical answer for this — `GlossaryApprovalWorkflow.json` pairs
`userApprovalTask` (the decision) with `setEntityAttributeTask` (the status change). **The workflow
owns both.** Onboarding reimplements that today instead of feeding it.

Target: a playbook gate defines *what must be true*; when its blocking checks pass it hands off to a
referenced `WorkflowDefinition` via `WorkflowHandler.triggerWithSignal(...)` — the same entry point
`WorkflowEventConsumer` already uses. Onboarding never writes `entityStatus` again.

> The mockup is explicit: *"Your existing review workflow — the playbook only decides when it is
> allowed to start."* Reference, not generate.

## Model gaps

| Design | Today |
|---|---|
| Playbook per asset type, with version/status/maintainer, on its own page | `IntakeForm.onboarding` sub-object |
| Playbook-defined stages, incl. `Published` and "Add stage" | `OnboardingStage` fixed 5-enum; `gates` `maxItems: 5` |
| 5 check types: attribute, relationship, responsibility, assessment, approval | `type: {field, approval}` |
| Per-check Blocking / Recommended / Optional | requiredness only via `formFields` |
| Assistance: AI draft / copy from similar / example / none | absent |
| Gate: hard-block, notify on stall, reassign after N days | absent |
| Gate hands off to a named workflow | absent |
| "Applies when" conditions | present (`onboardingCondition`) |

A field is asked for **once per playbook** — the check library filters out fields already captured at
another gate.

## Status

Schema, backend, migration and the admin UI have landed. Remaining: the mockup's richer producer
wizard (AI draft, term suggestions, access-route picker) and board metric tiles - the existing
producer surfaces were ported to the new model but not rebuilt to the mockup's depth.

## Plan

### 1. Schema (`openmetadata-spec/`) - DONE
1. `onboardingStage.json` — fixed enum becomes a stage descriptor (`key`, `label`, `order`, optional
   `entityStatus` mapping so a workflow's `setEntityAttributeTask` can align).
2. `onboardingStep.json` → check: add `checkType` (5), `requirement` (blocking/recommended/optional),
   `assistance` (ai/autofill/example/none). Keep `conditions`, `guidance`, `rules`, `assignment`.
3. `onboardingGate.json` — add `handoffWorkflow` (entityReference), `blockTransition`,
   `notifyOnStall {enabled, days}`, `reassignAfter {enabled, days, role}`.
4. New entity `entity/governance/onboardingPlaybook.json` — one per asset type; `entityType`,
   `stages[]`, `gates[]`, `status`, `owners`, standard entity fields.
5. `intakeForm.json` — deprecate `onboarding`; retain as migration read path.
6. Lift `maxItems: 5` on gates.

### 2. Generate - DONE
`make generate` (venv required; this worktree's symlinked venv is x86_64 — see caveat below).

### 3. Backend (`openmetadata-service/`) - DONE
- New `OnboardingPlaybookRepository` / `Mapper` / `Resource`, `CollectionDAO.OnboardingPlaybookDAO`,
  `Entity.ONBOARDING_PLAYBOOK`, seed data.
- Rewrite `OnboardingEvaluator`: drop `stageFor`/`nextStatus`; evaluate per the playbook's own stages.
- Rewrite `OnboardingService.transition`: hand off to `handoffWorkflow` instead of setting status.
- **Delete** the `OnboardingTasks.recordDecision` call from `TaskRepository.resolveTask`; decisions
  arrive from the workflow instead.
- Gate behaviours (stall notify, reassign) as scheduled work.

### 4. Migrations (`bootstrap/sql/migrations/native/2.1.0/`) - DONE
- `onboarding_playbook` table (MySQL + Postgres).
- Data migration: each existing `IntakeForm.formFields` → that asset type's playbook **Creation gate**,
  preserving requiredness. Matches the mockup's "migrated as-is".

### 5. UI (`openmetadata-ui/`) - admin surfaces DONE, producer depth outstanding
Admin:
- Governance settings card ("Onboarding Playbooks", `New` + `Includes Intake Forms` badges, the
  "Intake Forms moved" callout).
- Playbook manager list page (asset type, enforced at creation, structure, maintained by, assets).
- Playbook editor **full page** (replacing `IntakeFormDesignerModal`): lifecycle rail with gate
  chips + "Add stage", checks table, "The gate itself" panel with workflow handoff + toggles, and the
  right-hand check inspector.

Producer:
- "Required to create" wizard (Creation gate, enforced at API + UI).
- Guided Draft checklist with assistance affordances.
- Onboarding board with the three metric tiles, progress, waiting-on, in-stage.

### 6. Verification
`mvn -pl openmetadata-service -am clean package`, targeted ITs, `yarn test`, `ui-checkstyle`,
`yarn i18n`, token audit.

## Environment caveats (this machine)

- Only the arm64 **JDK 22** works (`~/Library/Java/JavaVirtualMachines/openjdk-22.0.2`); the JDK 21 and
  the `env/` venv are x86_64 and fail with "bad CPU type". `make generate` therefore needs a working
  arm64 venv before Python model regeneration.
- Always build with `-am` **and** `clean` — a non-clean incremental `jsonschema2pojo` run silently
  drops `$ref`-inherited schema defaults and produces phantom test failures.
