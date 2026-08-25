K8s Pipeline Client + OMJob Operator Logic Flow
================================================

This document describes how `K8sPipelineClient` drives ingestion pipelines on Kubernetes and how
the `openmetadata-k8s-operator` custom resources (OMJob/CronOMJob) execute them.

High-Level Components
---------------------
- K8sPipelineClient (server side)
  - Builds workflow config and security config.
  - Creates ConfigMaps/Secrets.
  - Creates Jobs, CronJobs, OMJobs, or CronOMJobs depending on configuration.
- OMJob Operator (custom controller)
  - Reconciles OMJob: runs main pod, then exit handler pod.
  - Reconciles CronOMJob: schedules OMJobs based on cron schedule.

Deployment Flow (deployPipeline)
--------------------------------
1. Build workflow config (`WorkflowConfigBuilder`).
   - Ensures OpenMetadata server connection exists.
   - If missing, creates a default connection from server config and ingestion-bot JWT.
2. Create or update a ConfigMap:
   - Name: `om-config-<pipelineName>`
   - Data key: `config` (workflow YAML string)
3. Create or update a Secret:
   - Name: `om-secret-<pipelineName>`
   - Data key: `securityConfig` (JSON)
4. If the pipeline has a schedule:
   - If `useOMJobOperator = true`: create/update a `CronOMJob` custom resource.
   - Else: create/update a native Kubernetes `CronJob`.
5. If the pipeline has no schedule:
   - Ensure any existing CronJob/CronOMJob for that pipeline is deleted.
6. On failure, rollback any newly-created resources (ConfigMap, Secret, CronJob/CronOMJob).

ConfigMaps: role and usage
--------------------------
- Purpose: store the workflow configuration payload as a Kubernetes-native resource so Jobs, CronJobs, and OMJobs can
  reference it without embedding large YAML in pod specs.
- Shape: a single ConfigMap per pipeline named `om-config-<pipelineName>` with key `config` holding the workflow YAML.
- Consumption:
  - Native Job/CronJob: container env var `config` is populated via `valueFrom.configMapKeyRef`.
  - OMJob/CronOMJob: the operator copies the env var into the pod spec; it still resolves from the ConfigMap at runtime.
- Lifespan: the ConfigMap is updated on pipeline deploy; it is not deleted on each run, so scheduled and on-demand runs
  always read the latest config.

SERDE between K8s API and operators
-----------------------------------
- K8sPipelineClient builds Java objects (Jobs, CronJobs, OMJobs) and serializes them to the Kubernetes API.
- The operator (for OMJob/CronOMJob) deserializes those custom resources, reconciles desired state, and then re-serializes
  core K8s resources (Pods/Jobs) back to the API.
- For scheduled OMJobs, the operator performs a second SERDE pass: it reads the CronOMJob template, materializes a new
  OMJob with a concrete `pipelineRunId`, then writes it to the API so it can be reconciled like a normal OMJob.

On-Demand Execution Flow (runPipeline)
--------------------------------------
1. Generate a run ID and job name.
2. If `useOMJobOperator = true`:
   - Create an `OMJob` custom resource with:
     - Main pod spec: `python main.py` with env vars including `config`.
     - Exit handler pod spec: `python exit_handler.py` with minimal env.
3. If `useOMJobOperator = false`:
   - Create a native Kubernetes `Job` with a single container running `python main.py`.
4. Return the run ID and job name.

Scheduled Execution Flow
------------------------
Native CronJob path (`useOMJobOperator = false`)
- `CronJob` spec runs a Job template that:
  - Runs `python main.py`.
  - Pulls `config` from the pipeline ConfigMap via `valueFrom.configMapKeyRef`.
  - Uses the pipeline labels and optional annotations.

Custom CronOMJob path (`useOMJobOperator = true`)
- `K8sPipelineClient` creates a `CronOMJob` custom resource with:
  - `spec.schedule`, `timeZone`, `startingDeadlineSeconds`, and history limits.
  - `spec.omJobSpec` template for OMJob execution.
  - `pipelineRunId` env var set to placeholder `{{ omjob.uid }}`.
- `CronOMJobReconciler`:
  1. Parses cron schedule and computes last/next execution time.
  2. Skips when suspended or outside starting deadline.
  3. Builds a new `OMJob` per schedule:
     - Copies pod specs and env vars.
     - Replaces `pipelineRunId={{ omjob.uid }}` with a real UUID.
  4. Creates the `OMJob` and updates `lastScheduleTime` and `lastOMJobName`.

OMJob Execution Flow (Operator)
-------------------------------
OMJob is a two-stage execution:
1. PENDING
   - Create main pod if missing.
   - Record main pod name in status.
2. RUNNING
   - Watch main pod until completion.
   - Capture exit code and transition to EXIT_HANDLER_RUNNING.
3. EXIT_HANDLER_RUNNING
   - Create exit handler pod (runs `exit_handler.py`).
   - Inject `pipelineStatus` env var based on main pod exit code.
4. SUCCEEDED / FAILED
   - Terminal states.
   - Optional pod cleanup after TTL expiration.

Labeling and Selection
----------------------
K8sPipelineClient labels all pipeline resources with:
- `app.kubernetes.io/name = openmetadata`
- `app.kubernetes.io/component = ingestion`
- `app.kubernetes.io/managed-by = openmetadata`
- `app.kubernetes.io/pipeline = <sanitized pipeline name>`
- `app.kubernetes.io/pipeline-type = <pipeline type>`
- `app.kubernetes.io/run-id = <run id>` (for non-scheduled runs)

The OMJob operator adds/uses:
- `omjob.pipelines.openmetadata.org/name`
- `omjob.pipelines.openmetadata.org/pod-type` (`main` or `exit-handler`)
- `app.kubernetes.io/managed-by = omjob-operator`

Logs, Status, and Control
-------------------------
- Logs: the server reads the most recent pod with `app.kubernetes.io/pipeline=<name>`.
  - Prefers OMJob "main" pod label if present.
- Toggle ingestion:
  - CronJob path: updates `spec.suspend`.
  - CronOMJob path: updates `spec.suspend` via custom object.
- Kill ingestion:
  - CronJob path: deletes active Jobs (orphaning pods).
  - OMJob path: deletes OMJob custom resources (operator cleans pods).
- Queue status: uses Kubernetes Jobs to detect queued runs (not OMJob CRs).

Configuration Notes
-------------------
- `skipInit=true` disables K8s client initialization (test-only).
- `startingDeadlineSeconds` defaults to 60 to avoid CronJob catch-up.
- Resource requests/limits, node selectors, image pull secrets, and annotations
  are applied to pod specs from config.
