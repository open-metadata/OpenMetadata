---
title: Ingestion Framework Deployment
slug: /deployment/ingestion
---

# Ingestion Framework Deployment

The Ingestion Framework is the module that takes care of bringing metadata in to OpenMetadata. It is used
for any type of workflow that is supported in the platform: Metadata, Lineage, Usage, Profiler, Data Quality,...

## Manage & Schedule the Ingestion Framework

In this guide, we will present the different alternatives to run and manage your ingestion workflows. There are mainly
2 ways of running the ingestion:
1. Internally, by managing the workflows from OpenMetadata.
2. Externally, by using any other tool capable of running Python code.

Note that the end result is going to be the same. The only difference is that running the workflows internally,
OpenMetadata will dynamically generate the processes that will perform the metadata extraction. If configuring
the ingestion externally, you will be managing this processes directly on your platform of choice.

## Option 1 - From OpenMetadata

If you want to learn how to configure your setup to run them from OpenMetadata, follow this guide:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="10k"
    bold="OpenMetadata UI"
    href="/deployment/ingestion/openmetadata" %}
    Deploy, configure and manage the ingestion workflows directly from the OpenMetadata UI.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

## Option 2 - Externally

Any tool capable of running Python code can be used to configure the metadata extraction from your sources.

In this section, we are going to give you some background on how the Ingestion Framework works, how to configure
the metadata extraction, and some examples on how to host the ingestion in different platforms.

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="10k"
    bold="External Ingestion"
    href="/deployment/ingestion/external" %}
    Manage the Ingestion Framework from anywhere!
  {% /inlineCallout %}
{% /inlineCalloutContainer %}
