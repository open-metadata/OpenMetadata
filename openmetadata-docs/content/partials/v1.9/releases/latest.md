# 1.8.9 Release 🎉

{% note noteType="Tip" %}
**1st August 2025**
{% /note %}

{% inlineCalloutContainer %}
{% inlineCallout
color="violet-70"
icon="celebration"
bold="Upgrade OpenMetadata"
href="/deployment/upgrade" %}
Learn how to upgrade your OpenMetadata instance to 1.8.9!
{% /inlineCallout %}
{% /inlineCalloutContainer %}

You can find the GitHub release [here](https://github.com/open-metadata/OpenMetadata/releases/tag/1.8.9-release).

# What's New

## Improvements

- Remove unnecessary braces in additional_config for cleaner code.
- Implemented comprehensive Security Service with schema changes, UI integration, and OSS visibility controls.
- Added backward-compatible support for documented owner configuration in dbt.
- Implemented configurable sink and reverse metadata support for Ranger, along with cleanup, bug fixes, and UI enhancements. (Collate)
- Added lineage propagation enhancements in Automator with stop conditions and propagation depth, along with related UI fixes, configuration support, and test improvements. (Collate)

## Fixes

- Fixed Incorrect or missing security labels.

**Full Changelog**: [link](https://github.com/open-metadata/OpenMetadata/compare/1.8.8-release...1.8.9-release)
