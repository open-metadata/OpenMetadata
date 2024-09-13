# 1.5.3 Release 🎉

{% note noteType="Tip" %}
**Sep 9th, 2024**
{% /note %}

{% inlineCalloutContainer %}
{% inlineCallout
color="violet-70"
icon="celebration"
bold="Upgrade OpenMetadata"
href="/deployment/upgrade" %}
Learn how to upgrade your OpenMetadata instance to 1.5.3!
{% /inlineCallout %}
{% /inlineCalloutContainer %}

You can find the GitHub release [here](https://github.com/open-metadata/OpenMetadata/releases/tag/1.5.3-release).

# What's Changed

## OpenMetadata
- Added resizable columns for custom properties
- Added support for automated ingestion of Tableau data source tags and description
- Improved "follow data" landing page module performance
- Improved search result suggestion by showing display name instead of FQN
- Fixed Cost Analysis issue when service has no connection
- Improved PII classification for JSON data types
- Fixed issue with expand all operation on terms page
- Fixed feed freezing when large images are part of the feed results
- Fixed dbt run_results file name with dbt cloud connection

## Collate
- Cleaned Argo logs artifacts
- Shipped VertexAI Connector
- Fixed automator lineage propagation issues with possible None entities

**Full Changelog**: https://github.com/open-metadata/OpenMetadata/compare/1.5.2-release...1.5.3-release
