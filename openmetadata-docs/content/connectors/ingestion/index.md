---
title: Metadata Ingestion
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

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    bold="Metadata Ingestion"
    icon="cable"
    href="/connectors/ingestion/workflows/metadata"
  >
    Learn more about how to ingest metadata from dozens of connectors.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    bold="Metadata Profiler"
    icon="cable"
    href="/connectors/ingestion/workflows/profiler"
  >
    To get metrics from your Tables
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    bold="Metadata Data Quality Tests"
    icon="cable"
    href="/connectors/ingestion/workflows/data-quality"
  >
    To run automated Quality Tests on your Tables.
  </InlineCallout>
   
  <InlineCallout
    color="violet-70"
    bold="Metadata Usage"
    icon="cable"
    href="/connectors/ingestion/workflows/usage"
  >
    To analyze popular entities.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    bold="Metadata Lineage"
    icon="cable"
    href="/connectors/ingestion/workflows/lineage"
  >
    To analyze relationships in your data platform.
  </InlineCallout>

</InlineCalloutContainer>

## Metadata Versioning

One fundamental aspect of Metadata Ingestion is being able to analyze the evolution of your metadata. OpenMetadata
support Metadata Versioning, maintaining the history of changes of all your assets.

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    bold="Metadata Versioning"
    icon="360"
    href="/connectors/ingestion/versioning"
  >
    Learn how OpenMetadata keeps track of your metadata evolution.
  </InlineCallout>
</InlineCalloutContainer>

## Best Practices

You want to know some of the best practices around metadata ingestion? This is the right place!

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    bold="Best Practices"
    icon="360"
    href="/connectors/ingestion/best-practices"
  >
    Learn the best practices to ingest metadata, both from the UI and using any custom orchestrator.
  </InlineCallout>
</InlineCalloutContainer>

## Deep Dive

Understand how OpenMetadata deploys the workflows that are created from the UI.

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    bold="Ingestion Pipeline UI Deployment"
    icon="360"
    href="/connectors/ingestion/deployment"
  >
    Learn about the Pipeline Service interface and how OpenMetadata handles workflow deployments.
  </InlineCallout>
</InlineCalloutContainer>
