# Incident Auto-Close on Test Pass

> **Slice 2 of 3** — Incident Manager → Governance Workflows Migration
> **Depends on**: [incident-lifecycle-workflow](../incident-lifecycle-workflow/proposal.md) (Slice 1)
> **Enables**: Nothing (independent feature)
> **ADR**: [adr-incident-manager-governance-workflows.md](../../../adr-incident-manager-governance-workflows.md)

---

## What Ships

When a previously-failing test case passes, the system automatically resolves the open incident (reason: `AutoResolved`) and closes its associated task. No human intervention required.

This fixes the **#1 gap** in today's incident manager — `setTestCaseResultIncidentId()` sets `incidentId = null` when a test succeeds but never resolves the incident or closes its task. Incidents stay open indefinitely even after the underlying issue is fixed.

**User-visible changes:**
- Test passes → open incident auto-resolves → task disappears from feed
- Resolution reason: `AutoResolved` (distinct from manual resolution)
- Configurable: users can add conditions, side effects, or disable via governance workflow UI

---

## What We Build

### ResolveIncidentTask Node

New automated task (`nodeType: automatedTask`, `nodeSubType: resolveIncidentTask`) that resolves the open incident for a given test case.

**ResolveIncidentImpl:**
1. Get test case FQN from workflow variables (`relatedEntity`)
2. Query for latest incident status
3. If unresolved → create Resolved record (reason: `AutoResolved`)
4. Close associated Thread task via repository
5. Repository's fire-and-forget terminates the lifecycle process (wired in Slice 1)

**User-facing config:**
```json
{
  "type": "automatedTask",
  "subType": "resolveIncidentTask",
  "config": { "reason": "AutoResolved" }
}
```

### Schema Changes

- `resolved.json`: Add `AutoResolved` to `TestCaseFailureReasonType` enum
- `nodeSubType.json`: Add `resolveIncidentTask`
- New `resolveIncidentTask.json` node definition

### Auto-Close Workflow Definition

Default **auto-close-incident-on-test-pass** workflow, ships enabled:
```
Trigger: TestCase ENTITY_UPDATED, filter: testCaseStatus == Success
Flow:    [Start] → [ResolveIncidentTask] → [End]
Config:  reason: "AutoResolved"
```

Short-lived, fire-and-forget — no long-lived state, no wait, no timers.

---

## Out of Scope

| Feature | Deferred to | Why |
|---------|-------------|-----|
| TTL / stale incident expiration | Slice 3 | Different mechanism (boundary timer) |
| Conditional auto-close rules | Future | Users can add `checkEntityAttributesTask` themselves |
| Post-close notifications | Future | Users can append `sinkTask` to the workflow |

---

## Why This Depends on Slice 1

`ResolveIncidentImpl` calls the repository to resolve → repository fire-and-forget terminates the lifecycle process. Without Slice 1, there's no lifecycle process to terminate. The resolution itself would still work (repository code is unchanged), but the architecture is cleaner with the lifecycle process in place — auto-close naturally terminates it.
