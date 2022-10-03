---
title: Metadata Ingestion Filter Patterns
slug: /openmetadata/ingestion/workflows/metadata/filter-patterns
---

# Metadata Ingestion Filter Patterns

The ingestion filter patterns are very useful when you have a lot of metadata available in your data source but 
some metadata might not be useful or relevent to produce any insights or discover data for ex. you might want to
filter out the log tables while ingesting metadata.

Configuring these metadata filters with OpenMetadata is very easy, which uses regex for matching and filtering the metadata. 
Following documents will guide you on how to configure filters based on the type of data source

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    bold="Database Filter Patterns"
    icon="cable"
    href="/openmetadata/ingestion/workflows/metadata/filter-patterns/database"
  >
    Learn more about how to configure filters for database sources.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    bold="Dashboard Filter Patterns"
    icon="cable"
    href="/openmetadata/ingestion/workflows/metadata/filter-patterns/dashboard"
  >
    Learn more about how to configure filters for dashboard sources.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    bold="Pipeline Filter Patterns"
    icon="cable"
    href="/openmetadata/ingestion/workflows/metadata/filter-patterns/pipeline"
  >
    Learn more about how to configure filters for pipeline sources.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    bold="Topic Filter Patterns"
    icon="cable"
    href="/openmetadata/ingestion/workflows/lineage"
  >
    Learn more about how to configure filters for messaging  sources.
  </InlineCallout>
</InlineCalloutContainer>


