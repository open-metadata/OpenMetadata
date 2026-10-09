# Glossary tag propagation is a catalog preference that defaults to enabled

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `SystemResourceIT.testGlossaryTagPropagationPreference`, `TagLabelUtilTest`,
  `SearchRepositoryBehaviorTest`, and `CommonWidgets.hooks.test.tsx`
- **Related:** [#35044](https://github.com/open-metadata/OpenMetadata/issues/35044),
  `openmetadata-spec/src/main/resources/json/schema/configuration/glossarySettings.json`

## Context

Classification tags attached to glossary terms are derived on associated assets during reads and
propagated into their search documents. Catalogs that manage classifications separately need to
disable that behavior consistently across the API, search, and the glossary editor.

## Decision

The system setting `glossarySettings.enableTagPropagation` controls this behavior for the entire
catalog. It defaults to `true` so upgrades preserve existing behavior. Administrators can change
it under Preferences → Glossary; authenticated users can read it to determine whether the editor
needs a propagation warning. The existing system settings endpoints and cache own persistence and
invalidation.

When disabled, asset reads omit glossary-derived classification tags without fetching the terms'
tags, glossary changes skip classification-tag propagation into asset search documents, and the
editor skips its propagation warning. Direct classification assignments and glossary associations
remain independent of the preference. Re-enabling the setting derives tags from the current terms.

## Consequences

No database migration is required: startup initializes the setting and missing configuration
defaults to enabled. The setting does not launch a catalog-wide search rewrite. Administrators
must reindex data assets after either transition to refresh existing search documents; the UI
states this requirement. Reads and new indexing operations use the current preference immediately.
Automatic reindexing would require a separate decision about scheduling and catalog-wide work.
