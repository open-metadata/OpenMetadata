---
title: Latest Release
slug: /releases/latest-release
---

# 1.1.5 Release 🎉

{% inlineCalloutContainer %}
{% inlineCallout
color="violet-70"
icon="celebration"
bold="Upgrade OpenMetadata"
href="/deployment/upgrade" %}
Learn how to upgrade your OpenMetadata instance to 1.1.5!
{% /inlineCallout %}
{% /inlineCalloutContainer %}

## UI
- Fixed signup page styling
- Fixed OIDC Keyset retrieval

## Ingestion
- Fixed BigQuery multi-project ingestion
- Upgrade Airflow base image to 2.6.3. This fixes Airflow's db migration.
- Fixed table usage count
- Add support for Tableau version 3.10
- Add support for BigQuery datasets named with hyphens

## Backend
- Standardized timestamp
- Improved Data Insights error management to improve result accuracy
- Improved API performance of Data Quality endpoints
