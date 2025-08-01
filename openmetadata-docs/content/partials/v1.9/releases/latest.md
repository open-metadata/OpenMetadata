# 1.8.8 Release 🎉

{% note noteType="Tip" %}
**30th July 2025**
{% /note %}

{% inlineCalloutContainer %}
{% inlineCallout
color="violet-70"
icon="celebration"
bold="Upgrade OpenMetadata"
href="/deployment/upgrade" %}
Learn how to upgrade your OpenMetadata instance to 1.8.8!
{% /inlineCallout %}
{% /inlineCalloutContainer %}

You can find the GitHub release [here](https://github.com/open-metadata/OpenMetadata/releases/tag/1.8.8-release).

# What's New

## Improvements

- Added missing database migrations for `searchSettings` changes introduced in version 1.8.7.
- Introduced support for the SSAS (SQL Server Analysis Services) connector.
- Enhanced memory management and ensured proper resource cleanup in the profiler.
- Updated OMeta logging for improved clarity and easier debugging.
- Enabled support for service accounts in the Synapse Connector. ${CollateIconWithLinkMD}
- Implemented chunked reading of archived logs in Argo Workflows to improve performance and memory efficiency. ${CollateIconWithLinkMD}
- Added external table reverse metadata support for Databricks and Unity Catalog. ${CollateIconWithLinkMD}
- Introduced Collate SaaS activity metrics integrated with OpenSearch telemetry. ${CollateIconWithLinkMD}

## Fixes

- Added Tableau CA certificate authentication to ensure secure connectivity.
- Skipped creation of redundant indexes for foreign keys referencing the same column multiple times.
- Fixed DataLake ingestion to handle larger files without failures or timeouts.
- Resolved Tableau ingestion issues by properly handling `None` entities.
- Ignored non-current columns for Iceberg tables in Glue and Athena environments.
- Fixed JSON processing issues related to Jakarta in the MCP Patch Tool.
- Addressed `clusterAlias` errors in the MCP SearchMetadataTool by implementing proper alias resolution for cross-environment compatibility.
- Fixed cyclic lineage node collapsing to prevent incorrect root node removal, with added unit and Playwright tests for validation.
- Ensured Airflow ingestion compatibility with older Airflow versions.
- Resolved Trino column validation errors for highly complex fields to ensure proper handling.
- Fixed alert mechanism to correctly display test case names and URLs upon failure.

**Full Changelog**: [link](https://github.com/open-metadata/OpenMetadata/compare/1.8.7-release...1.8.8-release)
