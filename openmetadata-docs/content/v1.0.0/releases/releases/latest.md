---
title: Latest Release
slug: /releases/latest-release
---

# [1.0.3 Release](https://github.com/open-metadata/OpenMetadata/releases/tag/1.0.3-release) - June 2nd 2023 🎉

## What's Changed

- fix: Tags can get deleted if the service name matches partially with targetFQN in [#11856](https://github.com/open-metadata/OpenMetadata/pull/11856)

# [1.0.2 Release](https://github.com/open-metadata/OpenMetadata/releases/tag/1.0.2-release) - May 24th 2023 🎉

## UI Improvements
- Supports a separate column for Classification and Glossary in the following entities: Topic, Dashboard, Pipeline, ML Model, Container, and Data Model.
- Improved Sample Data tab UX for Tables.
- Email is now displayed on the Teams page. Users can edit their Email.
- The custom logo can be configured from the UI. The logo will be displayed on the Login page and app bar.
- UI supports updating the displayName for service, database, schema, and all other assets.

## Ingestion
- Supports custom database name for Glue.
- Fixed Postgres lineage ingestion for version 11.6.
- Added api_version and domain fields to Salesforce connector.
- Kerberos libraries have been added to ingestion image.
- PII flags have been further restricted for column names.
- Fixed GitHub reader for LookML.
- Restructured the Tableau data models ingestion.
- Fixed the basic auth for Kafka.

## Backend
- Fixed vulnerabilities for dependencies.
- Supports custom logo from backend.
- Fixed a bug related to random password.
- By default, service connection details will be masked for users, and unmasked for bots. Users will be able to view based on their view permissions.
- Fixed Elasticsearch indexing issues for a large number of objects.
