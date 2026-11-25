# Data 360 Pipeline lineage and run status run in the metadata agent

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Ingestion maintainers
- **Guard:** `TestData360PipelineSourceRunsLineageAndStatus` in `test_data360pipeline.py`, `TestLineageSourceDoesNotDelete` in `test_data360pipeline_lineage.py`
- **Related:** #37631

## Context
Data 360 Pipeline shipped separate Lineage and Usage sources, unlike every other pipeline service.
The UI and AutoPilot build Lineage and Usage agents with database settings
(`DatabaseServiceQueryLineagePipeline`, `DatabaseUsageConfigType`), so those agents crashed on a
pipeline service. The server refused a usage agent with pipeline settings. And the lineage run, which
ran as the lineage bot, failed when it tried to delete stale pipelines.

## Decision
- The metadata agent extracts lineage (under `includeLineage`) and run status. `metadata.py`
  combines `Data360PipelineLineageMixin` and `Data360PipelineStatusMixin` over
  `Data360PipelineBaseSource`.
- `supportsLineageExtraction` / `supportsUsageExtraction` stay in `data360PipelineConnection.json`,
  defaulting to `false`. The 2.1.0 data migration sets them to `false` on existing services.
  Removing them would make stored connections fail validation, because the schema is
  `additionalProperties: false`.
- `Data360PipelineLineageSource` and `Data360PipelineOperationalSource` stay registered for agents
  and CLI configs that already exist. Neither deletes pipelines.

## Consequences
The UI and AutoPilot offer only the Metadata agent for this service. Making the separate agents
work instead would need pipeline-aware Lineage and Usage settings in the UI, AutoPilot and the
server. Revisit only if those exist for every pipeline service.
