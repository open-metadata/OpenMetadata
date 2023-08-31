---
title: Releases
slug: /releases
---

# 1.1.2 Release 🎉

{% inlineCalloutContainer %}
{% inlineCallout
color="violet-70"
icon="celebration"
bold="Upgrade OpenMetadata"
href="/deployment/upgrade" %}
Learn how to upgrade your OpenMetadata instance to 1.1.2!
{% /inlineCallout %}
{% /inlineCalloutContainer %}

## Data Quality
- Added support for Postgres version 11.19.
- Fixed MariaDB time column issues.

## Connectors
- Added JWT authentication support for Trino.
- Fixed Snowflake connection test.
- Fixed SageMaker ingestion.
- Added external table support for BigQuery.

## UI Improvements
- Added Russian language support.
- Supports Delete functionality for sample data.
- Improved Schema page UX.
- Table mentions now show Service, Schema and Database information.
- Fixed the version history list.

## Ingestion
- Improved performance when ingesting table constraints.

## Backend
- Improved Glossary import validations.
- Fixed Test Suite migrations and naming.
- Fixed Classification migration.
- Deprecated Flyway and using native migrations.
- Improved Test Suite UI performance.
