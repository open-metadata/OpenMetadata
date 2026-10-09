# Glossary tag propagation is a catalog preference that defaults to enabled

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial) · v2 2026-10-09 (conflict validation and cached reads)
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

## Amendment — 2026-10-09: validate suppressed tags and preserve cached reads

Mutual-exclusion validation is independent of propagation. Glossary edits, bulk asset/column
assignments, and asset writes still validate classifications that would be derived when propagation
is enabled. Only the returned or indexed tags are suppressed. This prevents disabled-period writes
from introducing conflicts that make assets unwritable after re-enabling propagation.

Derived asset tags are cached separately for each preference value. Warm reads return cached tags
without a glossary-tag query; a cold read can populate this cache from a raw read bundle. Changing
the setting evicts the tag-cache entries so re-enabling uses the current glossary classifications.
The invalidation scans only the tag-key pattern, on setting changes rather than asset reads.
`EntityRepositoryTagCacheTest` guards warm reads, both variants, and preference transitions;
`SystemResourceIT.testDisabledGlossaryPropagationStillValidatesConflicts` guards API validation.
