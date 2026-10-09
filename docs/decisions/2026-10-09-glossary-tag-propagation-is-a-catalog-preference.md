# Glossary tag propagation is a catalog preference that defaults to enabled

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial) · v2 2026-10-09 (conflict validation and cached reads) · v3 2026-10-09 (replica convergence and preference snapshots)
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
catalog. It defaults to `true` to keep propagation enabled on upgrades. Administrators can change
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
states this requirement. The replica handling the update invalidates its settings cache immediately;
other replicas can use the previous preference until their three-minute settings cache expires.
Reindex after replicas have observed the new preference.
Automatic reindexing would require a separate decision about scheduling and catalog-wide work.

## Amendment — 2026-10-09: validate suppressed tags and preserve cached reads

Mutual-exclusion validation is independent of propagation. Glossary edits, bulk asset/column
assignments, and asset writes still validate classifications that would be derived when propagation
is enabled. Only the returned or indexed tags are suppressed. This prevents disabled-period writes
from introducing conflicts that make assets unwritable after re-enabling propagation.

Derived asset tags are cached separately for each preference value. Warm reads return cached tags
without a glossary-tag query; a cold read can populate this cache from a raw read bundle. Changing
the setting triggers tag-cache eviction to refresh the derived glossary classifications.
The invalidation scans only the tag-key pattern, on setting changes rather than asset reads.
`EntityRepositoryTagCacheTest` guards warm reads, both variants, and preference transitions;
`SystemResourceIT.testDisabledGlossaryPropagationStillValidatesConflicts` guards API validation.

## Amendment — 2026-10-09: snapshot reads and document convergence

Settings invalidation is local to a JVM; it is not broadcast. During the three-minute convergence
window, replicas may disagree on read derivation and search propagation. The shared Redis tag-cache
eviction is best effort: a stale replica can repopulate entries, and an eviction failure can leave
old entries until the configured entity-cache TTL. Redis eviction failures are logged at ERROR.
These limits apply to tag freshness; mutual-exclusion validation remains active on every replica.

Read bundles intentionally now derive glossary classifications, matching ordinary asset reads.
Previously the bundle path returned raw tag usage and omitted these derived tags. With propagation
enabled, a cold glossary-tagged read adds a derived-tag batch query (chunked for large term lists);
the populated tag cache takes precedence over a bundle on subsequent reads. Disabled reads make
no derived-tag query. Each load uses one captured preference for derivation and its cache key, so
an on/off/on transition cannot cache a suppressed result as enabled. Batch merges use the fetched
map without looking up settings per entity, column, or tag.

The glossary editor shares the settings query cache with Preferences, reusing a fetched value for
one minute between saves. A successful preference toggle updates that same cache. If the settings
request fails, the editor reports the error and offers the propagation confirmation; users can
still save after confirming. `CommonWidgets.hooks.test.tsx` guards reuse and this fallback.
