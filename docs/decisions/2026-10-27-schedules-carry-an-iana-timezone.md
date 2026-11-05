# Schedules carry an explicit IANA timezone, and an absent zone keeps the pre-existing default

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** Mart
- **Guard:** `TimezoneUtilTest` (only IANA zone ids pass), `AppSchedulerTest.getCronScheduleAppliesTimezone`
  and `getCronScheduleWithoutTimezoneKeepsSchedulerDefault`,
  `IngestionPipelineRepositoryTest.testRequiresRedeployment_TimezoneChange_ShouldReturnTrue` (a zone
  change redeploys the CronJob), `AppsResourceIT.test_externalAppScheduleTimezone_syncsToPipelineAndRejectsUnknownZone`,
  `IngestionPipelineResourceIT.createRejectsUnknownPipelineTimezoneAndStoresIanaZone`
- **Related:** open-metadata/OpenMetadata#36354 (pod labels and annotations on every spawned
  resource, whose record lands with that PR)

## Context

Every schedule in the product ran at UTC. `airflowConfig.pipelineTimezone` existed on ingestion
pipelines and already reached Kubernetes CronJobs and CronOMJobs, but no UI set it, so the schema
default `UTC` was persisted on every pipeline. `appSchedule` had no timezone at all, so Quartz ran
application triggers in the server JVM zone, which is UTC in the official images.

A per-schedule zone needs one representation that the UI, the server, Quartz, the Kubernetes CronJob
controller and the OMJob operator all agree on.

## Decision

- `appSchedule.timezone` is a new optional string. Together with `airflowConfig.pipelineTimezone` it
  holds an **IANA zone id** such as `Europe/Berlin` or `UTC`. `TimezoneUtil` accepts only
  `ZoneId.getAvailableZoneIds()`; offsets such as `+02:00` are rejected with 400 because the
  Kubernetes CronJob controller resolves `spec.timeZone` against tzdata and would reject them.
  Repositories store the trimmed id (`TimezoneUtil.normalize`), never the raw input.
- The UI defaults a **new** schedule to the browser zone. Editing an app that has no stored zone
  leaves the zone unset (the picker shows its placeholder) and omits it from the save, so saving an
  unchanged dialog cannot move the app off the server default.
- An absent `appSchedule.timezone` keeps the Quartz default (the server JVM zone), so existing
  deployments do not change behaviour. An absent `pipelineTimezone` keeps its schema default `UTC`.
- The app schedule is the source of truth for the pipeline bound to an external app: its timezone is
  copied to `pipelineTimezone` on install and on every schedule change, and an app without a
  timezone resets the pipeline to `UTC`.
- The UI offers the timezone picker wherever it offers a cron (ingestion wizard, app install, app
  schedule edit) and defaults a new schedule to the browser zone.

## Consequences

- Operators in any zone can read a schedule as written. The cron description in the UI shows the zone
  in parentheses.
- Kubernetes CronJob `spec.timeZone` needs Kubernetes 1.27 or newer; older clusters ignore the field
  and run at the controller's zone.
- An Airflow cron follows the zone of a zone-aware `start_date`, so `build_dag_configs` anchors the
  DAG start date in `pipelineTimezone`. Airflow and Kubernetes deployments run the cron in the same
  zone the UI shows.
- Periodic workflow triggers run in the server zone: Flowable's `TimerEventDefinition` has no zone
  and `CycleBusinessCalendar` resolves the cron with the engine clock. `PeriodicBatchEntityTrigger`
  rejects a schedule whose zone rules differ from the server's rather than dropping it silently,
  and `WorkflowDefinitionRepository.prepare` trims the zone and runs that check before the
  definition is stored. The check compares against the JVM zone of the server handling the request
  and only runs on create and edit, so every replica must run in the same zone (the engine clock
  that fires the timers needs that anyway), and a server moved to another zone rejects the next
  edit of a definition that names the old one until its zone is cleared or changed.
- Changing the stored representation (for example to an offset) would need a migration of every
  pipeline and app and a change to the operator and the k8s client in the same release.
