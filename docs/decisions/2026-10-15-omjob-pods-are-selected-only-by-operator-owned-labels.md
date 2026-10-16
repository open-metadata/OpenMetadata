# The OMJob operator selects its pods only by labels it alone owns

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `LabelBuilderTest` (pod labels built from server-shaped OMJobs must match the
  selectors, and spec labels cannot override the identity labels), `PodManagerLabelSelectionTest`
  and `OMJobReconcilerTtlCleanupTest` (lookup and TTL cleanup against an in-memory API server that
  evaluates label selectors)
- **Related:** open-metadata/OpenMetadata#33319, #25172, #26971, #27143, #35513

## Context

The operator finds the pods of an OMJob with a label selector, for TTL cleanup and for the main and
exit handler lookups. It writes its own labels on those pods and then copies the labels the server
puts in the OMJob spec (`K8sPipelineClient` sends the same set on every OMJob, scheduled, run-now and
application). When a selector used a label that the server also sets, `app.kubernetes.io/managed-by`,
the server's value won on the pod and the selector matched nothing. TTL cleanup then deleted no pods
and finished pods piled up forever, while the main and exit handler lookups kept working only through
their fallback to the pod name recorded in the OMJob status.

This went back and forth across three PRs: #25172 added `managed-by` to the selector, #26971 removed
it, and #27143 brought it back two days later, most likely while resolving a merge conflict. Every
2.0 release shipped with it.

## Decision

- Pod selectors use only labels the operator alone owns: `omjob.pipelines.openmetadata.org/name`,
  plus `omjob.pipelines.openmetadata.org/pod-type` to tell the main pod from the exit handler.
- The operator writes those two labels after the OMJob spec labels, so no OMJob spec can change them.
- Labels the server sets, such as `app.kubernetes.io/managed-by=openmetadata`, are copied onto the
  pods unchanged and are never used in a selector.

## Consequences

- Users can keep selecting ingestion pods by the server's labels (NetworkPolicies, monitoring), and
  pods created by any earlier release match the operator's selectors.
- Adding a label to a selector needs that label to be written by the operator only, after the spec
  labels. A label the server also sends must stay out of every selector.
- Cleanup still deletes the pods recorded in the OMJob status when the selector misses them, and
  logs a warning when it does, so a future violation of this record shows up in the operator logs
  instead of as leaked pods.
