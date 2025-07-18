# 1.8.4 Release 🎉

{% note noteType="Tip" %}
**16th July 2025**
{% /note %}

{% inlineCalloutContainer %}
{% inlineCallout
color="violet-70"
icon="celebration"
bold="Upgrade OpenMetadata"
href="/deployment/upgrade" %}
Learn how to upgrade your OpenMetadata instance to 1.8.4!
{% /inlineCallout %}
{% /inlineCalloutContainer %}

You can find the GitHub release [here](https://github.com/open-metadata/OpenMetadata/releases/tag/1.8.4-release).

# What's New

## Improvements

- Search RBAC enhancements for better performance and accuracy.
- Revamped metrics system with detailed request latencies and breakdown of database/search operations.
- Added Virtual Threads and Semaphore control for improved performance.
- Enhanced browser language support with fixes for Chinese (zh) language search indexing.
- Improved German UI translations.
- Dashboard service prefix support for better organization.
- Added columns.description in search settings for enhanced discoverability.
- Improved handling of appPrivateConfig with empty parameters.
- Enhanced JVM parameters optimization for Java 21.
- Added missing supportsMetadataExtraction flag in connectors.
- Implement Freshness Test on Pandas. (Collate)

## Fixes

- Handle text overflow in CommonEntitySummaryInfo and improved loader in search bar.
- Fixed soft-delete and restore handling for charts linked to dashboards.
- Fixed null columns handling in various scenarios.
- Fixed Postgres query column name for execution time.
- Fixed pagination alignment issues in UI.
- Resolved race condition in bulk import between websocket and REST API.
- Fixed column lineage validation and update/delete operations.
- Fixed activity feed not showing column-level metadata changes.
- Fixed issues with Chinese (zh) language search index mapping.
- Corrected parent FQN extraction for column FQN.
- Fixed NPE when reading appPrivateConfig with empty parameters.
- Fixed recursive suggestion application for deeply nested columns.
- Fixed auto pilot trigger button enable state.
- Fixed custom logo failure causing repetitive API calls.
- Fixed unaligned charts display.
- Removed "Default: null" from columns for better JSON to POJO handling.
- Updated button names for consistency.
- Set Presidio logger to ERROR level to reduce noise.
- Reverse Metadata - Illegal result error. (Collate)

**Full Changelog**: [link](https://github.com/open-metadata/OpenMetadata/compare/1.8.3-release...1.8.4-release)
