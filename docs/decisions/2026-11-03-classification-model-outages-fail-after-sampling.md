# Classification model outages fail the run after sampling completes

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Issue owner
- **Guard:** `test_model_loading.py`, `test_base_processor.py`, `test_classification_workflow.py`, `test_model_loading_failure.py`
- **Related:** https://github.com/open-metadata/OpenMetadata/issues/32241

## Context

Auto-classification and sample persistence share a workflow. A language model may fail during initialization or later when an `any` recognizer needs another language. Aborting immediately loses unaffected sampling; continuing with fewer recognizers changes classification coverage and conflict resolution.

## Decision

The first typed model-loading failure disables all classification for that run. Sampling and permitted sample writes continue. Discard pending tags for the interrupted entity, retain previously persisted results and existing tags, and record one actionable classification failure.

After processing drains, pipeline state, the CLI status file, and the printed result report failure regardless of the ordinary success threshold. Normal CLI execution raises; explicit `raiseOnError: false` retains its existing suppression behavior. Source, sink, configuration, and inference errors keep their existing handling.

Model initialization completes before an engine enters the loader cache. The cache holds at most 32 usable engines, enough for the currently mapped models and typical custom models while bounding retained NLP memory. Failed loads are never cached; a fresh workflow retries after repair.

## Consequences

Operators can repair models and rerun without losing successful sample writes. Retries may repeat sampling. The workflow does not roll back earlier tags or silently substitute a reduced classifier. Only model-operation failures enter this recovery path; process and resource signals are not normalized into model outages.
