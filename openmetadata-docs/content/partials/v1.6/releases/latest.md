# 1.6.9 Release 🎉

{% note noteType="Tip" %}
**Apr 8th, 2025**
{% /note %}

{% inlineCalloutContainer %}
{% inlineCallout
color="violet-70"
icon="celebration"
bold="Upgrade OpenMetadata"
href="/deployment/upgrade" %}
Learn how to upgrade your OpenMetadata instance to 1.6.9!
{% /inlineCallout %}
{% /inlineCalloutContainer %}

You can find the GitHub release [here](https://github.com/open-metadata/OpenMetadata/releases/tag/1.6.9-release).

- Added policy validation to user creation flow.
- Fixed missing permission issue when adding users to a team.
- Fixed issue with empty SMTP password handling.
- Fixed Azure authentication flow for null refresh token.
- Added logging for import/export operations.
- Fixed lineage ingestion with null checks in fromEntity processing.
- Added readTimeout input field for connector configurations.
- Fixed topic import logic for Kinesis connector.
- Fixed PATCH API to correctly apply inherited owners.
- Ensured correct href loading using server URL.
- Made fields immutable for Applications to prevent unexpected modifications.

**Full Changelog**: [link](https://github.com/open-metadata/OpenMetadata/compare/1.6.8-release...1.6.9-release)
