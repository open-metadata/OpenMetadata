# Incident Lifecycle Workflow

> **Slice 1 of 3** — Incident Manager → Governance Workflows Migration
> **Depends on**: Nothing (first slice)
> **Enables**: [incident-auto-close](../incident-auto-close/proposal.md), [incident-ttl](../incident-ttl/proposal.md)
> **ADR**: [adr-incident-manager-governance-workflows.md](../../../adr-incident-manager-governance-workflows.md)

---

## What Ships

When a test case's incident status changes, a governance workflow reacts to the event — creating the Thread/task on new incidents and closing it on resolution. The workflow is a single branching definition that users can see and extend in the governance workflows UI.

**User-visible changes:**
- Incident Thread/task created immediately on test failure (no longer deferred to Ack)
- Auto-assign to table owner configurable (default: unassigned, matching current behavior)
- Incident lifecycle visible in governance workflows UI
- Users can customize by adding steps to workflow branches (e.g., notifications, Jira)
- Re-open from Resolved to any non-Resolved status creates a new incident lifecycle

**Behavior preserved:**
- REST API surface unchanged
- Ack and Assigned transitions unchanged in repository (assignee patching)
- TCRS record creation unchanged (synchronous, for incidentId linking)
- Severity inference unchanged (in repository)

---

## What We Build

### Generic Task Nodes: `openTask` and `closeTask`

Two new generic governance workflow nodes, reusable beyond incident management:

**`openTask`** (`nodeType: automatedTask`, `nodeSubType: openTask`):
- Idempotently creates a Thread with configurable `TaskType` and `TaskStatus.Open`
- If a Thread/task already exists for the entity, it's a no-op
- Optional auto-assign via `responsibles` config (default: unassigned)
- Configurable via `template` (e.g., `"incident"`, future: `"review"`)

**`closeTask`** (`nodeType: automatedTask`, `nodeSubType: closeTask`):
- Closes an open Thread/task for the entity
- If no open Thread/task exists, it's a no-op

Both follow the three-layer pattern: Task (BPMN) → Delegate (JavaDelegate) → Impl (pure logic).

### TCRS Event Broadcasting

Extend `EntityLifecycleEventDispatcher` to broadcast `TestCaseResolutionStatus` events to registered handlers. TCRS is a time-series entity that does NOT emit ChangeEvents, so this is a new event pipeline.

Flow: `storeInternal()` → `EntityLifecycleEventDispatcher` → `WorkflowHandler` → Flowable signal

### Signal-Driven Workflow Triggering

Every TCRS event broadcasts a Flowable signal `"tcrs_{fqn}"` with the TCRS status as a process variable. The signal starts a new short-lived process instance in every matching workflow. No Flowable queries needed for routing.

### Default Incident Lifecycle Workflow

Single branching workflow, ships enabled:
```
Trigger: Signal "tcrs_{fqn}" (from TCRS event broadcast)

[Signal Start] → [Gateway: status?]
    ├─ NOT Resolved → [OpenTask] → [End]
    ├─ Resolved     → [CloseTask] → [End]
    └─ Otherwise    → [End]
```

All process instances are short-lived in Slice 1 (no timers). OpenTask and CloseTask are idempotent — safe to fire on every event. The gateway routes purely on TCRS status; nodes handle their own edge cases.

---

## Out of Scope

| Feature | Deferred to | Why |
|---------|-------------|-----|
| Auto-close on test pass | Slice 2 | Independent feature, separate workflow |
| TTL / stale incident expiration | Slice 3 | Timer subprocess with signal boundary |
| Timer subprocess + signal interruption | Slice 3 | Architecture supports it, no timers yet |
| `tcrs_closed_{fqn}` termination signal | Slice 3 | Only needed for timer subprocess interruption |
| Cleanup timer for orphaned processes | Follow-up | Batch sweep; idempotent openTask handles most |
| Custom lifecycle states | Future | Template-driven state machine evolution |

---

## Open Questions

- **EntityLifecycleEventDispatcher extension**: What's the cleanest way to add TCRS event broadcasting? Observer registration, interface, or direct handler call?
- **Thread/task creation**: Does `openTask` create the Thread directly via `FeedRepository.create()`, or reuse `TestCaseResolutionStatusRepository.createTask()`?
- **Signal payload**: Can signal variables carry enough context (status, FQN, stateId) to avoid a DB read in the gateway, or should each node read from DB independently?
