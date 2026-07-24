# Incident TTL (Auto-Close Stale Incidents)

> **Slice 3 of 3** — Incident Manager → Governance Workflows Migration
> **Depends on**: [incident-lifecycle-workflow](../incident-lifecycle-workflow/proposal.md) (Slice 1)
> **Enables**: Nothing (terminal slice)
> **ADR**: [adr-incident-manager-governance-workflows.md](../../../adr-incident-manager-governance-workflows.md)

---

## What Ships

Incidents open longer than a configurable deadline (e.g., 30 days) are automatically resolved with reason `Expired`. Configurable per workflow, disabled by omitting the `ttl` field.

**User-visible changes:**
- Stale incidents auto-close after deadline
- Resolution reason: `Expired` (distinct from `AutoResolved` and manual)
- TTL configurable per workflow (ISO 8601 duration: `P30D`, `P7D`, etc.)
- Default workflow ships with `ttl: "P30D"`

---

## What We Build

### TTL Boundary Timer on HumanInterventionTask

Add an **interrupting boundary timer** to the HIT SubProcess (built in Slice 1):

```
Existing HIT (from Slice 1):
  [StartEvent] → [SetupPhase] → [Gateway] → [IntermediateCatchEvent: wait] → [End]

New addition (conditional on ttl config):
  + [BoundaryTimer: TTL deadline, interrupting]
      → [ServiceTask: AutoResolveExpiredImpl]
          - Create Resolved status (reason: "Expired") via repository
          - Close Thread task via repository
      → [EndEvent]
```

Only compiled into BPMN when `ttl` is set in the HIT config. No TTL = no timer = no overhead.

**AutoResolveExpiredImpl:**
1. Get test case FQN from process business key
2. Create Resolved record (reason: `Expired`) via repository
3. Close Thread task
4. Process ends (interrupting timer terminates the subprocess)

### Schema Changes

- `resolved.json`: Add `Expired` to `TestCaseFailureReasonType` enum
- `humanInterventionTask.json`: Document `ttl` field (ISO 8601 duration)

### Updated Default Workflow

Update incident-lifecycle workflow to include TTL:
```json
{ "config": { "template": "incident", "responsibles": { "source": "tableOwner" }, "ttl": "P30D" } }
```

---

## Out of Scope

| Feature | Deferred to | Why |
|---------|-------------|-----|
| SLA escalation timers | Future | Same boundary timer infrastructure, different business logic |
| Per-severity TTL | Future | Requires conditional timer duration |
| TTL warning notification | Future | Non-interrupting timer before deadline |

---

## Design Notes

**Interrupting, not non-interrupting.** When TTL fires, the incident is expired — nothing left to wait for. The subprocess terminates.

**Boundary timer, not polling.** Flowable fires the timer exactly once at the deadline, per process instance. No table scans, no cron. At 75K incidents with 30-day TTL, overhead is negligible.

**`Expired` vs `AutoResolved`.** Different operational signals: "issue was fixed" (auto-close) vs "nobody looked at this" (TTL). Enables distinct reporting and alerting.
