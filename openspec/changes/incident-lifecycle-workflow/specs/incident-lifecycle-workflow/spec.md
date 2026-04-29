## ADDED Requirements

### Requirement: TCRS event broadcasting via EntityLifecycleEventDispatcher
After `storeInternal()` persists a `TestCaseResolutionStatus` record, the system SHALL broadcast the event via `EntityLifecycleEventDispatcher` to registered handlers. `WorkflowHandler` SHALL receive the event and broadcast a Flowable signal.

#### Scenario: TCRS record creation triggers signal broadcast
- **WHEN** `storeInternal()` persists a new TCRS record (any status: New, Ack, Assigned, Resolved)
- **THEN** `EntityLifecycleEventDispatcher` SHALL notify registered handlers
- **AND** `WorkflowHandler` SHALL broadcast a Flowable signal `"tcrs_{testCaseFQN}"` with process variables including `status`, `testCaseFQN`, `stateId`, and `entityLink`

#### Scenario: Signal starts new process instances
- **WHEN** signal `"tcrs_{testCaseFQN}"` is broadcast
- **AND** a workflow definition has a SignalStartEvent matching that signal
- **THEN** Flowable SHALL create a new process instance with the signal variables as process variables

#### Scenario: Multiple workflows can react to same event
- **WHEN** signal `"tcrs_{testCaseFQN}"` is broadcast
- **AND** multiple workflow definitions have matching SignalStartEvents
- **THEN** each workflow SHALL independently start a new process instance

### Requirement: Default incident lifecycle workflow ships enabled
A default governance workflow definition (`IncidentLifecycleWorkflow.json`) SHALL be bootstrapped on server startup. It SHALL trigger on TCRS events via signal `"tcrs_{testCaseFQN}"`, and its flow SHALL branch on status: non-Resolved events route to `openTask`, Resolved events route to `closeTask`. Auto-assign is NOT enabled by default.

#### Scenario: Workflow is loaded on server startup
- **WHEN** the OpenMetadata server starts
- **THEN** the `IncidentLifecycleWorkflow.json` file in `json/data/governance/workflows/` SHALL be loaded by `initSeedDataFromResources()` with `createOrUpdate` semantics
- **AND** the workflow definition SHALL be available via the governance workflows API

#### Scenario: New failure creates Thread/task via openTask branch
- **WHEN** a TCRS record with status `New` is persisted (test case failure)
- **THEN** the signal starts a new process instance
- **AND** the gateway routes to the `openTask` node (status != Resolved)
- **AND** `openTask` creates a Thread/task with `TaskType.RequestTestCaseFailureResolution`
- **AND** the process ends (short-lived)

#### Scenario: Ack/Assigned event is no-op via openTask branch
- **WHEN** a TCRS record with status `Ack` or `Assigned` is persisted
- **THEN** the signal starts a new process instance
- **AND** the gateway routes to the `openTask` node (status != Resolved)
- **AND** `openTask` detects the Thread/task already exists and is a no-op
- **AND** the process ends (short-lived)

#### Scenario: Resolved event closes Thread/task via closeTask branch
- **WHEN** a TCRS record with status `Resolved` is persisted
- **THEN** the signal starts a new process instance
- **AND** the gateway routes to the `closeTask` node (status == Resolved)
- **AND** `closeTask` closes the open Thread/task
- **AND** the process ends (short-lived)

#### Scenario: Re-open from Resolved creates new lifecycle
- **WHEN** a TCRS record with any non-Resolved status is persisted after a previous Resolved record for the same incident
- **THEN** the signal starts a new process instance
- **AND** the gateway routes to the `openTask` node (status != Resolved)
- **AND** `openTask` detects no open Thread/task exists (previous was closed) and creates a new one
- **AND** the process ends (short-lived)

### Requirement: All processes are short-lived (Slice 1)
In Slice 1, all workflow process instances SHALL complete within the same synchronous call. No process SHALL enter a wait state or persist Flowable runtime rows between events.

#### Scenario: Process completes before API returns
- **WHEN** a TCRS event triggers a workflow process
- **THEN** the process SHALL execute all nodes and reach an end event before the signal broadcast call returns
- **AND** no `ACT_RU_EXECUTION` rows SHALL persist for the process after completion

### Requirement: Ack case backward compatibility
The `Ack` case in `openOrAssignTask()` SHALL check for an existing Thread/task before creating one. If the workflow already created a task, the Ack SHALL patch the assignee on the existing task instead of creating a duplicate.

#### Scenario: Ack with existing workflow-created task patches assignee
- **WHEN** a user Acknowledges an incident
- **AND** `getIncidentTask()` returns an existing Thread (created by the workflow's openTask)
- **THEN** `openOrAssignTask()` SHALL call `patchTaskAssignee()` on the existing Thread with the acknowledging user
- **AND** SHALL NOT call `createTask()`

#### Scenario: Ack without existing task creates task (fallback)
- **WHEN** a user Acknowledges an incident
- **AND** `getIncidentTask()` returns null (workflow did not run, e.g., Flowable was down)
- **THEN** `openOrAssignTask()` SHALL call `createTask()` as before
- **AND** incident lifecycle SHALL continue normally

### Requirement: Severity inference remains in repository
Severity inference SHALL continue to be called inside `storeInternal()` during incident record creation. The workflow does NOT duplicate severity inference — it relies on the severity already being set on the record when it reads it.

#### Scenario: Severity is inferred before workflow sees the record
- **WHEN** `getOrCreateIncident()` creates a new `TestCaseResolutionStatus` record
- **THEN** `storeInternal()` SHALL call `inferIncidentSeverity()` before persisting
- **AND** the record SHALL have severity set when `openTask` reads it to create the Thread/task

### Requirement: incidentId linking remains synchronous
The `TestCaseResolutionStatus` record creation (for `incidentId` linking) SHALL remain synchronous in `getOrCreateIncident()`. The workflow handles Thread/task lifecycle synchronously via the event dispatcher (same thread) after the record is persisted.

#### Scenario: Test result links to incident synchronously
- **WHEN** `setTestCaseResultIncidentId()` is called for a failing test result
- **THEN** `getOrCreateIncident()` SHALL create the `TestCaseResolutionStatus` record synchronously
- **AND** the `stateId` SHALL be available for linking to the test result within the same transaction
- **AND** the Thread/task creation SHALL happen via the workflow triggered by the event broadcast (still within the same synchronous call)

### Requirement: Thread/task lifecycle moves out of repository
The `New` case in `storeInternal()` SHALL no longer create Thread/tasks directly. The `resolveTask()` method SHALL no longer close Thread/tasks directly. These responsibilities move to the workflow's `openTask` and `closeTask` nodes respectively.

#### Scenario: storeInternal New case does not create Thread
- **WHEN** `storeInternal()` handles a `New` TCRS record
- **THEN** it SHALL persist the record and infer severity (unchanged)
- **AND** it SHALL broadcast the event via EntityLifecycleEventDispatcher
- **AND** it SHALL NOT create a Thread/task directly (the workflow's openTask handles this)

#### Scenario: resolveTask does not close Thread directly
- **WHEN** `resolveTask()` resolves an incident
- **THEN** it SHALL persist the Resolved record
- **AND** it SHALL broadcast the event via EntityLifecycleEventDispatcher
- **AND** the workflow's closeTask SHALL handle Thread closure
