## Context

The incident manager today is a switch statement in `TestCaseResolutionStatusRepository.storeInternal()` with no extension points. This design moves incident **Thread/task lifecycle** into the governance workflows framework using an event-driven, signal-based architecture where every TCRS event starts a short-lived process that reads state and acts.

Key files in the current system:

| Component | File | Role |
|---|---|---|
| State machine | `TestCaseResolutionStatusRepository.storeInternal()` | Switch on New/Ack/Assigned/Resolved |
| Incident creation | `TestCaseResolutionStatusRepository.getOrCreateIncident()` | Creates `New` record, calls `storeInternal()` |
| Severity inference | `TestCaseResolutionStatusRepository.inferIncidentSeverity()` | Called inside `storeInternal()` before insert |
| Task creation | `TestCaseResolutionStatusRepository.openOrAssignTask()` | Creates Thread on Ack, patches assignee on Assigned |
| Resolution | `TestCaseResolutionStatusRepository.resolveTask()` | Closes Thread task via `closeTaskWithoutWorkflow()` |
| incidentId linking | `TestCaseResultRepository.setTestCaseResultIncidentId()` | Calls `getOrCreateIncident()` synchronously |
| Workflow engine | `WorkflowHandler.java` | Flowable ProcessEngine singleton |
| Node registration | `NodeFactory.java` | Switch on `NodeSubType` |
| Event routing | `WorkflowEventConsumer.sendMessage()` | Routes ChangeEvents to Flowable signals |
| Event dispatcher | `EntityLifecycleEventDispatcher` | Synchronous observer-based event system |
| Trigger filter | `FilterEntityImpl.java` | Evaluates JSON Logic against **full entity** (fetched with Include.ALL) |

---

## Goals / Non-Goals

**Goals:**
- Move incident Thread/task lifecycle into a governance workflow
- Enable auto-assign on incident creation (configurable, default off)
- Ship a default branching workflow that handles open/close
- Introduce reusable `openTask` and `closeTask` node types
- Extend event pipeline to broadcast TCRS events to workflows
- Handle re-open from Resolved to any non-Resolved status

**Non-Goals:**
- Auto-close on test pass (Slice 2)
- TTL / stale incident expiration (Slice 3)
- Timer subprocess or signal-based timer interruption (Slice 3)
- Cleanup timer for orphaned processes (follow-up work)
- Changing the Ack/Assigned assignee-patching logic
- Custom lifecycle states
- UI changes

---

## Decisions

### D1: Event-driven architecture — storeInternal broadcasts, workflow reacts

**Decision:** `storeInternal()` is decoupled from Flowable. After persisting a TCRS record, it broadcasts an event via `EntityLifecycleEventDispatcher`. A registered handler in `WorkflowHandler` receives the event and broadcasts a Flowable signal. The workflow starts from the signal and handles lifecycle actions.

**Event flow:**
```
storeInternal() persists TCRS record
  → EntityLifecycleEventDispatcher.postCreate(tcrsRecord)
    → WorkflowHandler.onTcrsEvent(tcrsRecord)
      → runtimeService.signalEventReceived("tcrs_{testCaseFQN}", variables)
        → Flowable starts new process instance(s) in matching workflow(s)
```

**Why EntityLifecycleEventDispatcher (not ChangeEvents):**
- TCRS is a time-series entity that does NOT emit ChangeEvents
- EntityLifecycleEventDispatcher is synchronous (same thread) — no async delay
- The API call returns only after the workflow process completes (short-lived processes reach end event before the signal call returns)
- Already used for search indexing; natural extension point

**Signal variables carried:**
- `status`: the TCRS status (New, Ack, Assigned, Resolved)
- `testCaseFQN`: the test case fully qualified name
- `stateId`: the incident state ID
- `entityLink`: the entity link from the TCRS record

**What stays in `storeInternal()`:**
- Record persistence (unchanged)
- Severity inference (unchanged, see D6)
- `Ack` case: assignee patching on existing Thread (see D5)
- `Assigned` case: assignee patching (unchanged)
- Event broadcast (new)

**What moves to the workflow:**
- Thread/task creation (currently in `openOrAssignTask()` Ack case)
- Thread/task closure (currently in `resolveTask()`)

### D2: Generic nodes — openTask and closeTask (replaces HumanInterventionTask)

**Decision:** Instead of a monolithic `HumanInterventionTask`, build two generic, composable nodes following the three-layer pattern:

**openTask:**

| Layer | Class | Responsibility | Flowable dependency |
|-------|-------|----------------|---------------------|
| **Task** | `OpenTask` | Builds ServiceTask BPMN element. References delegate class name. | Yes (BPMN model only) |
| **Delegate** | `OpenTaskDelegate implements JavaDelegate` | Receives config via `Expression` fields. Sets `taskCreated` process variable. | Yes (thin adapter) |
| **Impl** | `OpenTaskImpl` | Idempotent Thread/task creation. No Flowable imports. | **None** |

**closeTask:**

| Layer | Class | Responsibility | Flowable dependency |
|-------|-------|----------------|---------------------|
| **Task** | `CloseTask` | Builds ServiceTask BPMN element. References delegate class name. | Yes (BPMN model only) |
| **Delegate** | `CloseTaskDelegate implements JavaDelegate` | Receives config via `Expression` fields. Sets `taskClosed` process variable. | Yes (thin adapter) |
| **Impl** | `CloseTaskImpl` | Thread/task closure. No Flowable imports. | **None** |

Reference: `CreateAndRunIngestionPipelineTask` → `CreateIngestionPipelineDelegate` → `CreateIngestionPipelineImpl`

**openTask config:**
```json
{
  "template": "incident",
  "taskType": "RequestTestCaseFailureResolution",
  "responsibles": { "source": "tableOwner" }
}
```

- `template`: identifies the task template (for future extensibility)
- `taskType`: the `TaskType` enum value for Thread creation
- `responsibles` (optional): auto-assign config. Omitted = unassigned (default)
  - `{ "source": "tableOwner" }` → resolve table entity owner
  - `{ "source": "specificUser", "target": "user.fqn" }` → specific user

**closeTask config:**
```json
{
  "template": "incident",
  "taskType": "RequestTestCaseFailureResolution"
}
```

**Idempotency:**
- `openTask`: queries for existing open Thread/task for the entity. If found → no-op, sets `taskCreated=false`. If not found → creates Thread, sets `taskCreated=true`.
- `closeTask`: queries for open Thread/task. If found → closes it, sets `taskClosed=true`. If not found → no-op, sets `taskClosed=false`.

**Runs as `governance-bot`** — the `WorkflowEventConsumer` already skips events from governance-bot, preventing infinite loops.

### D3: Signal architecture — broadcast for fan-out, no queries

**Decision:** Use Flowable signals (broadcast) for workflow triggering. Signals are the right primitive because:
1. Multiple workflows can react to the same TCRS event (fan-out)
2. No need to query Flowable for existing processes (signals are fire-and-forget)
3. Each workflow's signal start event independently creates a new process instance

**Slice 1 signal:**
- `tcrs_{testCaseFQN}` — broadcast on every TCRS event. Starts new processes.

**Slice 3 signal (deferred):**
- `tcrs_closed_{testCaseFQN}` — broadcast by `closeTask`. Caught by signal boundary events on timer subprocesses to interrupt/cancel timers.

**Why signals, not messages:**
- Messages are unicast (delivered to one specific execution). Would require knowing which process to target → Flowable queries.
- Signals are broadcast (all listeners receive). No routing logic needed.
- The "double fire" concern (signal catches both start events and intermediate catches) is handled by using different signal names for different purposes.

**Flowable does NOT enforce business key uniqueness.** Multiple process instances can share the same business key. This is fine — short-lived processes complete quickly and don't accumulate.

### D4: Short-lived processes — every event is an episode

**Decision:** Every TCRS event starts a new short-lived process instance. The process reads state, acts, and ends. No long-lived processes in Slice 1.

**BPMN structure for default workflow:**
```
[SignalStartEvent: "tcrs_{testCaseFQN}"]
  → [ExclusiveGateway: statusGateway]
      condition: ${status != "Resolved"}
        → [ServiceTask: openTask] → [EndEvent]
      condition: ${status == "Resolved"}
        → [ServiceTask: closeTask] → [EndEvent]
      default:
        → [EndEvent: skipEnd]
```

**Process lifecycle per event:**

| TCRS Event | Gateway route | Node action | Process duration |
|---|---|---|---|
| New (first failure) | NOT Resolved | openTask creates Thread | Milliseconds |
| Ack | NOT Resolved | openTask no-op (Thread exists) | Milliseconds |
| Assigned | NOT Resolved | openTask no-op (Thread exists) | Milliseconds |
| Resolved | Resolved | closeTask closes Thread | Milliseconds |
| Resolved→New (re-open) | NOT Resolved | openTask creates new Thread | Milliseconds |
| Resolved→Ack (re-open) | NOT Resolved | openTask creates new Thread | Milliseconds |

**Why short-lived:**
- No Flowable state accumulation (no `ACT_RU_*` rows between events)
- No need to correlate messages to running processes
- No orphan cleanup needed
- Idempotent nodes make repeated execution safe

**Slice 3 evolution:** The openTask branch gains a timer subprocess:
```
  → [ServiceTask: openTask]
    → [SubProcess: timerChain]
        [Timer: 24h] → [Notify] → [Timer: 7d] → [AutoClose] → [End]
        SignalBoundaryEvent (interrupting): "tcrs_closed_{fqn}"
    → [EndEvent]
```
The timer subprocess makes the New/Ack branch long-lived. When Resolved arrives, a new short-lived process runs closeTask AND broadcasts `tcrs_closed_{fqn}`, which interrupts the timer subprocess via its signal boundary event. All timers are cancelled, the old process ends cleanly.

**Only Resolved kills timers.** Ack/Assigned events don't interrupt the timer subprocess — reminders continue counting from the original failure time. This is a deliberate product choice: "remind the (now assigned) person" is still useful.

### D5: Ack backward compatibility

**Decision:** Modify `openOrAssignTask()` for the `Ack` case to check if a Thread/task already exists before creating one.

**Why:** With the workflow creating the Thread/task on the `New` event (immediately on test failure), by the time a user Acks, the task already exists. Today, `Ack` unconditionally calls `createTask()`, which would create a duplicate.

**Change:** In `openOrAssignTask()`, the `Ack` case mirrors the `Assigned` pattern:
```java
case Ack -> {
    Thread existingTask = getIncidentTask(incidentStatus);
    if (existingTask == null) {
        createTask(incidentStatus, Collections.singletonList(incidentStatus.getUpdatedBy()));
    } else {
        patchTaskAssignee(existingTask, incidentStatus.getUpdatedBy(),
            incidentStatus.getUpdatedBy().getName());
    }
}
```

This is backward-compatible: if the workflow didn't run (Flowable was down), the Ack fallback creates the task.

### D6: Severity inference stays in repository

**Decision:** `inferIncidentSeverity()` is already called inside `storeInternal()` during record creation. No change needed — severity is inferred when the record is created, before the workflow fires.

**Confirmed by code trace:** `getOrCreateIncident()` → `createNewRecord()` → `storeInternal()` → `inferIncidentSeverity()`.

### D7: Bootstrap mechanism for default workflow

**Decision:** Add a JSON file to the existing bootstrap directory at `openmetadata-service/src/main/resources/json/data/governance/workflows/`.

The server's `WorkflowDefinitionResource.initialize()` calls `initSeedDataFromResources()` on startup, which loads all JSON files matching `.*json/data/workflowDefinition/.*\.json$` and persists them via `createOrUpdate` semantics.

Two workflows already bootstrap this way:
- `GlossaryApprovalWorkflow.json`
- `RecognizerFeedbackReviewWorkflow.json`

We add `IncidentLifecycleWorkflow.json` following the same pattern.

### D8: Schema changes

**New files:**
- `openmetadata-spec/.../governance/workflows/elements/nodes/automatedTask/openTask.json` — openTask config schema
- `openmetadata-spec/.../governance/workflows/elements/nodes/automatedTask/closeTask.json` — closeTask config schema
- `openmetadata-service/.../governance/workflows/elements/nodes/automatedTask/OpenTask.java` — Task layer
- `openmetadata-service/.../governance/workflows/elements/nodes/automatedTask/CloseTask.java` — Task layer
- `openmetadata-service/.../governance/workflows/elements/nodes/automatedTask/impl/OpenTaskDelegate.java` — Delegate
- `openmetadata-service/.../governance/workflows/elements/nodes/automatedTask/impl/OpenTaskImpl.java` — Impl
- `openmetadata-service/.../governance/workflows/elements/nodes/automatedTask/impl/CloseTaskDelegate.java` — Delegate
- `openmetadata-service/.../governance/workflows/elements/nodes/automatedTask/impl/CloseTaskImpl.java` — Impl
- `openmetadata-service/src/main/resources/json/data/governance/workflows/IncidentLifecycleWorkflow.json` — Bootstrap data

**Modified files:**
- `openmetadata-spec/.../governance/workflows/elements/nodeSubType.json` — Add `openTask`, `closeTask`
- `openmetadata-service/.../governance/workflows/elements/NodeFactory.java` — Add switch cases for openTask, closeTask
- `openmetadata-service/.../governance/workflows/WorkflowHandler.java` — Add TCRS event handler, signal broadcasting
- `openmetadata-service/.../EntityLifecycleEventDispatcher.java` (or equivalent) — Register TCRS event broadcasting
- `openmetadata-service/.../jdbi3/TestCaseResolutionStatusRepository.java` — Add event broadcast in `storeInternal()`, modify `openOrAssignTask()` Ack case, remove Thread creation from `New` path, remove Thread closure from `resolveTask()`
- `openmetadata-service/.../jdbi3/TestCaseRepository.java` — Add event broadcast in resolution paths

### D9: Timer subplot architecture (Slice 3 prep)

**Decision (deferred to Slice 3, documented here for architectural clarity):**

When timers are added (reminders, TTL), the openTask branch gains an embedded subprocess:

```
[openTask] → [SubProcess: timerChain]
    ┌──────────────────────────────────────────────────┐
    │ [Timer: 24h] → [Notify] → [Timer: 7d] → [Close] │
    │                                                    │
    │ SignalBoundaryEvent (interrupting):                │
    │   "tcrs_closed_{testCaseFQN}"                     │
    └──────────────────────────────────────────────────┘
```

The signal boundary event catches `tcrs_closed_{fqn}` (broadcast by closeTask in the Resolved branch's process). Since Flowable signals are broadcast, the same closeTask execution simultaneously:
1. Completes its own short-lived process (Resolved branch)
2. Interrupts any running timer subprocess in an older process (via signal boundary)

No Flowable queries needed. The two-signal pattern (`tcrs_{fqn}` for fan-out, `tcrs_closed_{fqn}` for termination) cleanly separates concerns.

---

## Risks / Trade-offs

**[EntityLifecycleEventDispatcher is synchronous]**
→ The workflow process runs in the same thread as the API call. If the workflow takes too long, the API response is delayed. **Mitigation:** All processes in Slice 1 are short-lived (milliseconds). The idempotent nodes do a DB query + conditional insert — comparable to the current `storeInternal()` logic. For Slice 3, timer subprocesses enter a wait state quickly (the timer setup is fast, only the wait is long).

**[Multiple processes for same business key]**
→ Flowable does not enforce business key uniqueness. Multiple short-lived processes could theoretically run concurrently for the same FQN (e.g., rapid Ack + Assigned). **Mitigation:** Idempotent nodes make this safe — the second process simply no-ops. DB-level row locking on Thread creation prevents duplicates.

**[TCRS event pipeline is new infrastructure]**
→ Extending EntityLifecycleEventDispatcher for TCRS is new code. **Mitigation:** The pattern already exists for other entities (search indexing). The extension is small — one handler registration + one method call.

**[Ack backward compatibility]**
→ If the workflow fails to create the Thread/task (Flowable down, config error), the `Ack` path falls back to creating the task — because `getIncidentTask()` returns null and `createTask()` is called. This is a natural fallback, not a designed dual-path.

**[Signal name collision]**
→ Signal names include the test case FQN, which can be long. **Mitigation:** Flowable stores signal names as strings with no length limit in `ACT_RU_EVENT_SUBSCR`. FQNs are already bounded by entity naming constraints.

---

## Open Questions

- **EntityLifecycleEventDispatcher extension**: What's the cleanest integration? A new `TcrsEventHandler` interface, a method on `WorkflowHandler`, or a lambda registration?
- **Thread/task creation details**: Does `OpenTaskImpl` create the Thread directly via `FeedRepository.create()`, or does it call `TestCaseResolutionStatusRepository.createTask()`? The latter has coupled logic (severity, metrics) that may not apply.
- **Signal payload sufficiency**: Can signal variables carry enough context (status, FQN, stateId, entityLink) to avoid a DB read in openTask/closeTask, or should each node read from DB independently for freshness?
- **storeInternal removal scope**: How much of the `New` and `Resolved` cases can we remove vs. keep as fallback? If the dispatcher fails to fire, the old code path could serve as a safety net during rollout.
