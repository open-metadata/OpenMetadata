# Studio blocks publication writes until a server read resolves an uncertain outcome

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Ontology Studio implementation review
- **Guard:** useOntologyPublication.test.tsx, useOntologyPublication.utils.test.ts
- **Related:** ADR:2026-10-19-ontology-releases-allocate-semantic-versions, PR #36187

## Context

A capture, review-task or activation request can fail after the server has applied it, for example when the response is lost or the gateway times out. Repeating the write could capture a second release, create a second review task, or activate over a newer activation. The Studio needs a rule for when a write may be retried that does not depend on the failed response.

## Decision

Studio keeps one recovery receipt per user and ontology for each unresolved capture, review-task or activation write. It writes the receipt to `sessionStorage` under `ontology-publication-receipts-v1` before sending the request, so a reload in the same tab cannot lose it. While a receipt exists, capture, review, activation and reviewer edits are disabled.

Only the statuses 400, 401, 403, 404, 409, 412 and 422 are definitive rejections. They clear a capture receipt, and a review receipt becomes `failed`. Any other error, including network failures, timeouts and 5xx responses, leaves the receipt `unknown`.

A server read resolves an `unknown` receipt:

- Capture: the release history is scanned for a release that matches the attempt's metadata and has a revision above the one the attempt started from. A match clears the receipt, or turns it into a review receipt for that release when the user asked for review. The scan reads at most 10 pages of 100 rows and fails closed beyond that, and two matching releases fail it as ambiguous.
- Capture, no match: the ontology state is read before the history. If its working or activation revision differs from the attempt's, the server rejects the capture's `expectedWorkingRevision` or `expectedActivationRevision` check, so the capture cannot have landed after the history read, and the receipt is cleared. If both revisions are unchanged, the capture may still land, and the receipt stays.
- Review task: the release and its review are read. A task bound to the release clears the receipt. Without one, a `failed` receipt on a Draft release submits the task again.
- Activation: the receipt clears when the ontology's active release is the attempt's release. It becomes `conflict` when the activation revision moved without that release becoming active.

At most 8 receipts and 64 KiB are kept per origin tab. Beyond either, writes for ontologies without a receipt are refused instead of evicting a receipt that still guards a possible duplicate.

## Consequences

An outage never causes a duplicate capture, task or activation, at the cost of a disabled panel until the next successful read. A receipt for a capture that changed nothing on the server stays until a later edit moves the working revision or the user captures from another tab. The caps keep the storage bounded, and a user with 8 unresolved ontologies in one tab must resolve one before touching a ninth. Changing a status in the definitive list or a cap needs this record amended.
