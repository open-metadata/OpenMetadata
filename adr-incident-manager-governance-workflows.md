# Integrate Incident Manager in the Governance Workflows Framework

ADR-#: 1
Authors: Pablo Takara
Reviewers: Teddy Crépineau, Ram Narayan Balaji
Date: February 27, 2026
Status: Proposed

> Migrate incident lifecycle into a governance workflow using a new Task Lifecycle Node. The node uses OpenMetadata tasks as the source of truth (not Flowable UserTask), receives a template with configurable statuses, and exposes each status transition to the main workflow graph via process variables. Users wire hooks on any transition using standard edges. Non-terminal statuses loop back; terminal statuses auto-close the task.

---

## Context

The Incident Manager handles the lifecycle of data quality incidents in OpenMetadata. When a test case fails, an incident is created; it progresses through `New → Ack → Assigned → Resolved` as humans triage it.

Today, this lifecycle is a **switch statement** in `TestCaseResolutionStatusRepository.storeInternal()`. It handles state transitions, task creation, assignment, and resolution. The state machine is simple, correct, and performant, but it has **no extension points**. Adding a behavior like "on Assigned, notify via Slack" or "on New, auto-assign to table owner" requires modifying repository code, testing, and redeploying.

Meanwhile, OpenMetadata ships a **governance workflows framework** built on Flowable BPM. It is fully configurable via REST API and UI. Users configure workflows as abstract **trigger → nodes → edges** graphs (they never see BPMN XML). The backend compiles these to Flowable process definitions automatically via `NodeFactory` and `MainWorkflow`.

The two systems live side by side but do not interact.

Additionally, the **task refactor** promotes tasks to first-class entities with standard `ChangeEvents`. This enables Flowable to be notified of every status transition — not just resolution — unlocking configurable hooks on any transition from day one.

### Specific Gaps

1. **No auto-close when tests pass.** `TestCaseResultRepository.setTestCaseResultIncidentId()` sets `incidentId = null` when a test succeeds but **never resolves the incident or closes its task**.
2. **No auto-assign on incident creation.** Every incident starts in `New` and requires manual acknowledgement.
3. **No extensibility.** Organizations cannot define configurable rules like "on any status change, execute action X" without code changes.
4. **Fixed lifecycle.** The `New → Ack → Assigned → Resolved` states are hardcoded. Organizations with different triage processes have no way to customize.
5. **No incident TTL.** No mechanism to auto-close stale incidents.

### Enterprise scale context

- 5M assets, 10-30% with data quality tests = 500K-1.5M test cases
- At 2-5% failure rate = **10K-75K concurrent open incidents** (typical)
- `getOrCreateIncident()` enforces one unresolved incident per test case

---

## Use Cases

**UC-1 — Auto-close incident when test passes**
The system automatically resolves the open incident (reason: AutoResolved) and closes its task. No human intervention required.

**UC-2 — Auto-assign incident on creation**
When a new incident is created, the system automatically assigns it to a configured user or team.

**UC-3 — Auto-close stale incidents (TTL)**
An incident open longer than a configurable deadline is automatically resolved (reason: Expired).

**UC-4 — User-defined hooks on any status transition**
Users wire follow-up steps (notifications, Jira tickets, etc.) on any status change via workflow edges — no code changes.

---

## Decision

### Task Lifecycle Node

A new governance workflow node that does NOT use Flowable's BPMN UserTask. It creates an OpenMetadata task, waits for status changes via `IntermediateCatchEvent`, and exposes each status to the parent workflow for routing.

**Internal BPMN structure:**
```
┌─ SubProcess ──────────────────────────────────────────────────────┐
│                                                                    │
│  [Start] → [Setup] → [Gateway: created?]                          │
│               │          no → [End: skip]                          │
│               │          yes ↓                                     │
│               │        [IntermediateCatchEvent: wait]               │
│               │          ↓ message with {status}                   │
│               │        [Gateway: terminal?]                        │
│               │          yes → [CloseTask] → [SetResult] → [End]  │
│               │          no  → [SetResult] → [End]                 │
│               │                                                    │
│               │  Setup (idempotent):                               │
│               │    • Check for existing open incident              │
│               │      → if exists with active process: skip         │
│               │      → if orphaned process: terminate it           │
│               │    • Create incident record (New)                  │
│               │    • Create OM task                                │
│               │    • Auto-assign (from template config)            │
│               │    • Set process variable omTaskId = task UUID     │
│                                                                    │
│  + [TTL Boundary Timer: configurable, interrupting]                │
│      → [AutoResolve via repository] → [End]                       │
└────────────────────────────────────────────────────────────────────┘
```

**Node config:**
```json
{
  "type": "taskLifecycleNode",
  "config": {
    "template": "incident",
    "statuses": ["New", "Ack", "Assigned", "Resolved"],
    "terminal": ["Resolved"],
    "responsibles": { "source": "tableOwner" },
    "ttl": "P30D"
  }
}
```

The node:
1. **Setup** — Creates the OM task (idempotent on re-entry). Sets `omTaskId` process variable.
2. **Wait** — `IntermediateCatchEvent` with `messageExpression="${omTaskId}"`. Subscribes to a message named after the task UUID (~2 Flowable DB rows).
3. **On message** — Evaluates whether the received status is terminal.
4. **Terminal** — Closes the OM task (idempotent), sets `{nodeName}_result` at parent scope, subprocess exits.
5. **Non-terminal** — Sets `{nodeName}_result` at parent scope, subprocess exits. Parent-level edges route back to the node.

### Status exposed via graph edges (with cycles)

Status is set as a Flowable process variable when the subprocess exits. Parent-level edges condition on this variable. Non-terminal edges loop back to the node.

```
         ┌────── "ack" ───────────────────────────┐
         │  ┌─── "assigned" → [NotifySlack] ──────┤
         ▼  ▼                                      │
[Start] → [ManageIncident] ── "resolved" → [End]
```

**Workflow definition example:**
```json
{
  "name": "incident-lifecycle",
  "trigger": {
    "type": "eventBasedEntity",
    "config": {
      "entityTypes": ["TestCase"],
      "events": ["Updated"],
      "filter": { "TestCase": { "==": [{"var": "testCaseStatus"}, "Failed"] } }
    }
  },
  "nodes": [
    { "type": "startEvent", "name": "start" },
    { "type": "taskLifecycleNode", "name": "incident", "config": {
        "template": "incident",
        "statuses": ["New", "Ack", "Assigned", "Resolved"],
        "terminal": ["Resolved"],
        "responsibles": { "source": "tableOwner" },
        "ttl": "P30D"
    }},
    { "type": "automatedTask", "subType": "sinkTask", "name": "notifySlack" },
    { "type": "endEvent", "name": "end" }
  ],
  "edges": [
    { "from": "start", "to": "incident" },
    { "from": "incident", "to": "incident", "condition": { "status": "Ack" } },
    { "from": "incident", "to": "notifySlack", "condition": { "status": "Assigned" } },
    { "from": "notifySlack", "to": "incident" },
    { "from": "incident", "to": "end", "condition": { "status": "Resolved" } }
  ]
}
```

### Message delivery via task ChangeEvents

With the task refactor, tasks emit `ChangeEvents` on status changes. These drive message delivery to Flowable:

1. Task status changes (via REST API / `storeInternal`)
2. `ChangeEvent` emitted
3. Listener correlates message to waiting `IntermediateCatchEvent`

The OM task is already updated before the message fires. If correlation fails, the task state is correct — Flowable catches up on the next status change.

**Mechanism TBD**: Listener on task `ChangeEvents` (clean separation) vs direct hook in task status update code (fewer hops).

### What the workflow controls vs the repository

| Action | Who handles it |
| --- | --- |
| Task creation | Node setup phase (idempotent) |
| Status changes (Ack, Assigned, etc.) | Repository — synchronous, unchanged |
| Resolution | Repository — synchronous, unchanged |
| Task closure | Both — node closes on terminal, repository may also close. Idempotent. |
| Flowable notification | Task ChangeEvent → message to IntermediateCatchEvent |
| Follow-up hooks | Workflow edges — user-configurable |
| TTL auto-resolve | Boundary timer on node |
| Auto-close on test pass | Separate short-lived workflow |

### Why this approach

1. **Hooks on any transition.** Status exposed to parent graph → users wire follow-up steps via edges.
2. **Configurable lifecycle.** Template defines statuses and terminal set. No hardcoded lifecycle.
3. **OM task is source of truth.** No BPMN UserTask. ~2 DB rows per task vs ~5-10.
4. **Repository stays in the critical path.** All transitions are synchronous. Flowable is notified after the fact. If Flowable is down, transitions still succeed.
5. **Unified abstraction.** Same node type for incidents, approvals, certifications — different templates.

---

## Consequences

### Positive

- **Hooks on any status transition** without code changes.
- **Configurable lifecycle from day one** via template config.
- **Lightweight** — ~2 Flowable DB rows per task (IntermediateCatchEvent).
- **Safe** — repository owns all transitions synchronously; Flowable is follow-up only.
- **Default workflow replicates current behavior** and ships enabled.
- **Unified abstraction** — incidents, approvals, certifications share one node type.

### Negative

- **MainWorkflow compiler must support cycles.** Today it assumes a DAG. Biggest technical risk.
- **More Flowable interactions.** Every status change sends a message (vs resolution only). ~225K correlations over lifetime of 75K incidents with ~3 transitions each.
- **Task refactor dependency.** Fallback: direct `reportOutcome()` from `storeInternal()` if not ready.

### Neutral

- REST API surface unchanged.
- `TestCaseResolutionStatus` schema changes minimally (add `AutoResolved`, `Expired` reasons).
- Resolution business logic in the repository is unchanged.

---

## Alternatives Considered

### Bookends only (no intermediate state hooks)

Handle only creation + resolution in the workflow. Intermediate states stay entirely in `storeInternal()`.

**Not chosen:** Users cannot wire hooks on Ack/Assigned. The task refactor makes full lifecycle hooks possible now — deferring them means two migrations.

### Internal loop (cycle hidden inside SubProcess)

The message loop lives inside the node. Status exposed only on terminal exit. Outer graph stays a DAG.

**Not chosen:** Users cannot wire hooks on non-terminal transitions. The point is exposing every status change to the parent graph.

### Resolution through Flowable (not fire-and-forget)

Route resolution through the Flowable process.

**Not chosen:** Puts Flowable in the critical path. If Flowable is slow/down, resolution is blocked.

### Extend state machine with Java hooks

**Rejected:** Parallel automation system, requires code changes for every new behavior.

### CMMN (Case Management)

**Rejected:** Zero existing infrastructure, overkill.

---

## Design Choices

### IntermediateCatchEvent with messageExpression

`messageExpression="${omTaskId}"` gives unique-per-instance subscriptions. `EventSubscriptionQuery.eventName(taskId)` is an indexed lookup. No MessageCorrelationBuilder (doesn't exist in Flowable 7.2.0).

### Idempotent setup on loop re-entry

When non-terminal edges loop back, Setup detects the existing task and reuses it. Safe for any number of loops.

### Terminal auto-close — both sides

`storeInternal(Resolved)` closes the task. The node's `CloseTask` also closes on terminal status. Both are idempotent. This handles TTL (node-initiated) and human resolution (repository-initiated) uniformly.

### Business key = test case FQN

Enables idempotent creation, fire-and-forget termination, auto-close correlation.

### Governance-bot loop prevention

`WorkflowEventConsumer` skips events from `governance-bot`. The workflow runs as `governance-bot`, so its own events don't re-trigger workflows.

---

## Open Questions

- [ ] **Message delivery mechanism**: Listener on task ChangeEvents vs direct hook in task status update.
- [ ] **TestCaseResult.incidentId linking**: If creation moves to async workflow, test result may store before incident exists. Recommendation: keep `getOrCreateIncident()` synchronous.
- [ ] **Cycle validation**: Should the compiler enforce that every non-terminal edge path routes back to a task node?

---

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Cycle support in MainWorkflow | Blocks the design | Spike early. Workaround: invisible gateway node. |
| Task refactor not ready | No ChangeEvents for message delivery | Fall back to direct reportOutcome() from storeInternal() |
| Race condition | Message lost during follow-up execution | EventSubscriptionQuery returns null → skipped. Java-side buffer later. |
| ACT_RU growth | ~2 rows per open incident | 75K incidents = 150K rows. Measure in hardening phase. |
| Process orphaning | Never-resolved incidents linger | TTL handles deadlines. Batch sweep for the rest. |

---

## Follow-up Work

1. **Batch sweep** for orphaned processes.
2. **Migrate UserApprovalTask** (glossary) to same node type with `template: "approval"`.
3. **SLA timer escalation** — optional boundary timer using same infrastructure as TTL.

---

## References

- `TestCaseResolutionStatusRepository.storeInternal()` — Current state machine
- `WorkflowHandler.java` — Flowable ProcessEngine, message delivery
- `MainWorkflow.java` — BPMN compiler (needs cycle support)
- `UserApprovalTask.java` — Current UserTask pattern (being replaced)
- `NodeFactory.java` — Node type registration
- `WorkflowEventConsumer.java` — Event routing, governance-bot loop prevention
