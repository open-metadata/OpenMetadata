# 1.9.1 Release 🎉

{% note noteType="Tip" %}
**13th August 2025**
{% /note %}

{% inlineCalloutContainer %}
{% inlineCallout
color="violet-70"
icon="celebration"
bold="Upgrade OpenMetadata"
href="/deployment/upgrade" %}
Learn how to upgrade your OpenMetadata instance to 1.9.1!
{% /inlineCallout %}
{% /inlineCalloutContainer %}

You can find the GitHub release [here](https://github.com/open-metadata/OpenMetadata/releases/tag/1.9.1-release).

## Improvements
- Removed lastLoginTime from change Description.
- Add Grafana Support.
- Add OpenAPI YAML format support for REST API ingestion.
- Implement Cross Service Lineage.
- Precede source table name before pbi table name.
- Supported lineage table, highlight current root node and some Improvement around UI.
- Spark Engine UI Implementation (Collate).

## Fixes
- Fix Glossary Terms getting vanished for customized persona in Glossary Terms.
- Fix deleted assets being visible in Search Suggestions.
- Fix the upload dragger being enabled when file in process in Bulk Actions.
- Fix the keyboard delete action not working in Bulk Actions.
- Fix the PowerBI parse expression along with measure.
- Fix the expand icon after updating column details.
- Fix the default persona in user profile.
- Fix Bedrock Support.
- Fix User Metrics.
- Fix Telemetry Payload (Collate)

**Full Changelog**: [link](https://github.com/open-metadata/OpenMetadata/compare/1.9.0-release...1.9.1-release)
