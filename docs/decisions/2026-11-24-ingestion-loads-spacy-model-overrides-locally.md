# Ingestion loads spaCy model overrides locally

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** iamkiayun
- **Guard:** `test_model_loading.py`, `test_tag_analyzer_any_language.py`, `test_model_registry.py`
- **Related:** https://github.com/open-metadata/OpenMetadata/issues/32073, https://github.com/open-metadata/OpenMetadata/pull/38551, ADR:2026-11-03-classification-model-outages-fail-after-sampling

## Context

Deployments may need a spaCy model trained to recognize names and other entities in their data.
They need to select it per classification language while keeping model provisioning reproducible.

## Decision

The ingestion runner reads `OM_PII_SPACY_MODEL_<LANG>` when loading a model, where `<LANG>` is
the uppercase `ClassificationLanguage` value. An override names an installed spaCy package or a
local model path. A blank value counts as unset.

In an `any` workflow, recognizers configured for `any` use `OM_PII_SPACY_MODEL_ANY` when set.
Otherwise they follow English model selection, including `OM_PII_SPACY_MODEL_EN` when set.
Language-specific recognizers follow their own language selection. Without an override, language
selection uses the release-pinned models.

Overrides apply only at runtime and are never downloaded. If the configured model cannot load,
the runner raises a `ClassificationModelLoadError` in the `configured_model_load` phase.
`metadata install-classification-models` and image provisioning through
`AUTO_CLASSIFICATION_LANGUAGES` use the release-pinned registry.

## Consequences

Operators install or mount custom models in the ingestion runner's environment before running
classification. The load error directs them to repair the local model, and the workflow handles
it according to ADR:2026-11-03-classification-model-outages-fail-after-sampling.
