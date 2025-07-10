# 1.8.2 Release 🎉

{% note noteType="Tip" %}
**9th July 2025**
{% /note %}

{% inlineCalloutContainer %}
{% inlineCallout
color="violet-70"
icon="celebration"
bold="Upgrade OpenMetadata"
href="/deployment/upgrade" %}
Learn how to upgrade your OpenMetadata instance to 1.8.2!
{% /inlineCallout %}
{% /inlineCalloutContainer %}

You can find the GitHub release [here](https://github.com/open-metadata/OpenMetadata/releases/tag/1.8.2-release).

# What's New

## Improvements

- Implemented Prefix For Dashboard Service.
- Automator - Domain Lineage Propagation Support.
- Added Session Age for Cookies.
- Add maxRequestHeaderSize to server.applicationConnectors section in OpenMetaData default config file.
- Pbi display table name from source.
- Removed McpIntegrationTest.java.
- Added Virtual Threads and Semaphore to control.
- Browser language support.
- Add logs for all api calls.
- Add more debug logs; improve JVM params to be JVM 21.
- Show toast error on duplicate domain.
- Add filterJsonTree to the automatorAppConfig.
- Primary color customization.
- Add support for DBX system metrics.
- Improve the alert destination selection warning message.
- Supported rendering all suggestion on user avatar click.
- Add mcp preview.

## Fixes

- Relevant fields are pulled for bulk import.
- Snowflake map key type error.
- Data quality tab table pagination issue.
- Domain inheritance issue after team removal.
- Okta multi tab refresh issue.
- Api version endpoint page breaking due to STRING changeDescription updated.
- Fixed TotalDataAssetsWidget a stacked graph.
- Cron validations in Ingestion.
- Text Overflow from Widget and Table.
- Fixed column selection not persisting for all action in dropdown.
- Fixed mentions formatting in block editor.
- Fixed the token expiry options order.
- Column lineages are not getting updated/deleted when columns are updated/deleted.
- Custom logo failure leads to repetitive api calls for that image url.
- Fix psql migration data freshness.
- ActivityFeedProvider context not available in KnowledgeCenter page.
- Automator conditions not showing properly for the filters for custom properties.

**Full Changelog**: [link](https://github.com/open-metadata/OpenMetadata/compare/1.8.1-release...1.8.2-release)
