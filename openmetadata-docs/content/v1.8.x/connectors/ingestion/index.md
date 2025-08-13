---
title: Metadata Ingestion | OpenMetadata Data Pipeline Overview
description: Discover OpenMetadata'spowerful ingestion connectors to seamlessly extract metadata from databases, dashboards, pipelines & more. Setup guides included.
slug: /connectors/ingestion
---

# Metadata Ingestion

The goal of OpenMetadata is to serve as a centralised platform where users can gather and collaborate
around data. This is possible thanks for different workflows that users can deploy and schedule, which will
connect to the data sources to extract metadata.

Different metadata being ingested to OpenMetadata can be:

- Entities metadata, such as Tables, Dashboards, Topics...
- Query usage to rank the most used tables,
- Lineage between Entities,
- Data Profiles and Quality Tests.

In this section we will explore the different workflows, how they work and how to use them.

{%inlineCalloutContainer%}

{%inlineCallout
  bold="Metadata Ingestion"
  icon="cable"
  href="/connectors/ingestion/workflows/metadata"%}
Learn more about how to ingest metadata from dozens of connectors.
{%/inlineCallout%}

{%inlineCallout
  bold="Metadata Profiler"
  icon="cable"
  href="/how-to-guides/data-quality-observability/profiler/workflow"%}
To get metrics from your Tables=
{%/inlineCallout%}

{%inlineCallout
  bold="Metadata Data Quality Tests"
  icon="cable"
  href="/how-to-guides/data-quality-observability/quality"%}
To run automated Quality Tests on your Tables.
{%/inlineCallout%}

{%inlineCallout
  bold="Metadata Usage"
  icon="cable"
  href="/connectors/ingestion/workflows/usage"%}
To analyze popular entities.
{%/inlineCallout%}

{%inlineCallout
  bold="Metadata Lineage"
  icon="cable"
  href="/connectors/ingestion/workflows/lineage"%}
To analyze relationships in your data platform.
{%/inlineCallout%}

{%/inlineCalloutContainer%}

## Great Expectations

[Great Expectations](https://greatexpectations.io/) is a shared, open standard for data quality. It helps data teams eliminate pipeline debt, through data testing, documentation, and profiling. Learn how to configure Great Expectations to integrate with OpenMetadata and ingest your test results to your table service page.

{%inlineCallout
  bold="Great Expectations"
  icon="MdOutlineChangeCircle"
  href="/connectors/ingestion/great-expectations"%}
Ingest your test results from Great Expectations.
{%/inlineCallout%}

## Metadata Versioning

One fundamental aspect of Metadata Ingestion is being able to analyze the evolution of your metadata. OpenMetadata
support Metadata Versioning, maintaining the history of changes of all your assets.

{%inlineCalloutContainer%}

{%inlineCallout
  bold="Metadata Versioning"
  icon="360"
  href="/connectors/ingestion/versioning"%}
Learn how OpenMetadata keeps track of your metadata evolution.
{%/inlineCallout%}

{%/inlineCalloutContainer%}

## Best Practices

You want to know some of the best practices around metadata ingestion? This is the right place!

{%inlineCalloutContainer%}

{%inlineCallout
  bold="Best Practices"
  icon="360"
  href="/connectors/ingestion/best-practices"%}
Learn the best practices to ingest metadata, both from the UI and using any custom orchestrator.
{%/inlineCallout%}

{%/inlineCalloutContainer%}

## Deep Dive

Understand how OpenMetadata deploys the workflows that are created from the UI.

{%inlineCalloutContainer%}

{%inlineCallout
bold="Ingestion Pipeline UI Deployment"
icon="360"
href="/connectors/ingestion/deployment"%}
Learn about the Pipeline Service interface and how OpenMetadata handles workflow deployments.
{%/inlineCallout%}

{%/inlineCalloutContainer%}
