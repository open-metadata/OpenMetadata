# Terminal ingestion pipeline status reads and writes retry short-lived failures

- **Status:** Proposed
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** OpenMetadata ingestion maintainers (pending maintainer review)
- **Guard:** `ingestion/tests/unit/workflow/test_status_mixin_progress.py` (`TestTerminalStatusWriteRetry`)
- **Related:** #37081; PR #38310

## Context

The Agents tab renders live progress from a service-scoped SSE stream and rehydrates its cards from
persisted `pipelineStatuses` after a refresh. `BaseWorkflow.execute` persists the final
`PipelineState` and then emits a terminal progress frame. A transient failure in the final status
lookup or write can therefore leave the stored state at `Running` even when a live viewer saw the
run finish. A changed UI label alone cannot distinguish actual running, successful, partial, and
failed executions.

## Decision

- For terminal pipeline states, retry both the run-specific status GET and the final PUT **at most
  three times** each when the request fails with a transport error or HTTP 500/502/503/504.
- Use a short linear pause of 0.25 seconds times the failed attempt number, so this layer adds at
  most 0.75 seconds of pause per terminal read or write if its failures are immediately reported.
- Disable the REST client's HTTP retry loop for each terminal GET/PUT using the per-call
  `retries=0` override. The outer budget handles both gateway and transport failures, including
  mixed failure sequences, without restarting the REST client's long backoff. Ordinary callers
  retain the configured REST defaults.
- Accept `requests.HTTPError` as well as API-wrapped and transport exceptions. Gate HTTP retries
  on the response's actual status code, including plain HTML or empty gateway error responses.
- Do not retry non-terminal `Running` status operations or permanent errors such as 400/401/403.
- Re-read the **same run ID** on a retry, and PUT the **same status outcome and run ID**; never
  derive success merely from seeing a terminal progress event. Preserve partial success and failure.
- Keep the existing error logging path when the bounded retry budget is exhausted. This improves
  recoverability, but cannot guarantee persistence during a prolonged outage.

## Consequences

A transient failure on the final GET or PUT is less likely to produce a stale `Running` card after
a refresh. Ordinary running-state updates are unchanged. Terminal calls retain the existing network timeout
and urllib3 transport adapter behavior; three attempts bounds REST-level calls, not individual
socket operations or total wall-clock time. The REST client's 30/60/90-second HTTP backoff no
longer applies to terminal status calls.

The Oracle AutoPilot reproduction from #37081 has not been independently verified against this
failure mechanism. This proposed mitigation requires maintainer review, CI/unit checks, and
inspection of the persisted pipeline run status before the PR is considered complete.
