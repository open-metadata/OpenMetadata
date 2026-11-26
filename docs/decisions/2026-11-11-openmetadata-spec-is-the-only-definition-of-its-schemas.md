# openmetadata-spec is the only definition of its schemas; a downstream value or field is added here

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial) · v2 2026-11-11 (background job types are an open set; the downstream job types leave the spec)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** Collate's `CollateRuleFactory` fails the Collate build when a Collate schema redefines an openmetadata-spec schema or class (ADR:openmetadata-collate/2026-11-11-collate-generates-only-its-own-schemas); `reviewer` on this side; `JobDAOTest.workerReadsAJobTypeOpenMetadataDoesNotDefine` and `GenericBackgroundWorkerTest.runsAJobTypeOpenMetadataDoesNotDefineWithItsRegisteredHandler` for job types
- **Related:** ADR:openmetadata-collate/2026-11-11-collate-generates-only-its-own-schemas

## Context

Collate's build lays its schemas beside the unpacked openmetadata-spec schemas and generated Java
from the whole tree. A Collate file at an OpenMetadata path replaced the OpenMetadata class of the
same name at runtime. Collate copied `jobs/backgroundJob.json` to add its `ADMIN_OPS_*` job types
and `configuration/slackAppConfiguration.json` to add Slack socket mode. Every job type OpenMetadata
added afterwards was missing from Collate until the copy was synced by hand. That happened five
times; the last miss made every ontology library install fail on Collate with `NoSuchFieldError`
for `JobType.ONTOLOGY_PACK_INSTALL`.

## Decision

A schema under `openmetadata-spec/src/main/resources/json/schema/` has one definition, here. When a
downstream distribution needs another enum value or field on one of these schemas, the value or
field is added here, even if only that distribution uses it. `backgroundJob.json` therefore lists
the `ADMIN_OPS_*` job types Collate queues, and `slackAppConfiguration.json` carries
`connectionMode` and `appToken`. An addition made this way must be optional or unused for
OpenMetadata: a field that is not required, or has a default, and an enum value OpenMetadata never
writes.

## Consequences

OpenMetadata and Collate run one class per schema, so a value added here reaches both products in
the same change. The spec carries a few values OpenMetadata itself never produces. A downstream
change to one of these schemas now needs an OpenMetadata pull request first and a submodule update
after it.

## Amendment

**v2 2026-11-11.** `BackgroundJob.jobType` is a string, not an enum, so a background job type is no
longer a value a distribution adds here. The worker already ran a job by its `methodName` through
`JobHandlerRegistry`, and `background_jobs.jobType` is a `VARCHAR(256)`. The enum was enforced only
when a row was read back, where an unknown value threw. OpenMetadata's own types are constants in
`BackgroundJobTypes`. A distribution writes its own job type and registers the handler, with no
OpenMetadata change; Collate's `ADMIN_OPS_*`, `DELETE_ENTITY` and `DELETE_TOKEN` move to Collate.
The rule in the Decision still holds for every other schema, `slackAppConfiguration.json`
included.
