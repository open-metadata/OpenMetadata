# Configured pod labels and annotations go on every resource the k8s pipeline client creates, below the built-in labels

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** Mart
- **Guard:** `K8sPipelineClientTest.testConfiguredLabelsAndAnnotationsOnCronOMJob` and
  `testConfiguredLabelsAndAnnotationsOnPlainCronJobResources` (every top-level manifest and pod
  template carries the configured pairs; a configured key that collides with a built-in label keeps
  the built-in value)
- **Related:** ADR:2026-10-15-omjob-pods-are-selected-only-by-operator-owned-labels,
  openmetadata-helm-charts `pipelineServiceClientConfig.k8s.podLabels` / `podAnnotations`

## Context

`K8sPipelineClient` creates Jobs, CronJobs, OMJobs, CronOMJobs, ConfigMaps and Secrets in the
pipelines namespace outside of any GitOps manifest. A GitOps controller such as ArgoCD lists them as
orphaned unless they carry the controller's tracking label (`app.kubernetes.io/instance=<app>`) and
the annotations that keep them out of sync status and pruning. Not every platform team may edit the
ArgoCD `AppProject` to ignore them, so the server has to stamp the metadata itself.

The `podAnnotations` parameter existed but reached only pod templates and the OMJob objects, so
plain Jobs, CronJobs, ConfigMaps and Secrets stayed orphaned, and no label parameter existed at all.

## Decision

- `podLabels` and `podAnnotations` (`key=value,key=value` strings, env `K8S_POD_LABELS` and
  `K8S_POD_ANNOTATIONS`) are applied to the metadata of every object the client creates and to every
  pod template or OMJob pod spec, for ingestion, application and automation runs alike.
- Built-in labels (`app.kubernetes.io/name`, `component`, `managed-by`, `pipeline`, `pipeline-type`,
  `run-id`, `app-name`) are written after the configured labels, so a configured key can never
  change a value the client or the operator selects by.
- The Helm chart exposes both under `openmetadata.config.pipelineServiceClientConfig.k8s` and
  declares them in `values.schema.json`.

## Consequences

- An ArgoCD label-tracked application can own the spawned resources with
  `podLabels: app.kubernetes.io/instance=<app>` and
  `podAnnotations: argocd.argoproj.io/compare-options=IgnoreExtraneous,argocd.argoproj.io/sync-options=Prune=false`.
  Annotation-based tracking is not covered: its tracking id embeds each resource's own name.
- A new builder in the client must call `buildLabels`/`buildApplicationLabels`/
  `buildAutomationLabels` and `podAnnotations()` on every `V1ObjectMeta` it creates, or the resource
  shows up as orphaned again.
- Values cannot contain a comma, since the pair list splits on it.
