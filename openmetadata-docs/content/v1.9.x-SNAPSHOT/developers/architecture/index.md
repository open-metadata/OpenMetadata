---
title: OpenMetadata System Architecture | Developer Guide
slug: /developers/architecture
---

# Architecture

OpenMetadata Unlock the value of data assets with an end-to-end metadata platform that includes data discovery, governance, data quality, observability, and people collaboration.

OpenMetadata depends on following components to build a metadata platform:

- JsonSchemas for defining Metadata Schemas
- Dropwizard/Jetty for REST APIs
- MySQL 8.x to store Metadata
- ElasticSearch 7.x to index Metadata and power search

{% image src="/images/v1.9/developers/architecture/architecture.png" alt="OpenMetadata architecture" caption=" " /%}

To understand the OpenMetadata Architecture and how everything fits together please go through [Design page](/main-concepts/high-level-design).

For Schema design and how our API works here is an example of ML [Model entity page](/sdk/python/entities/ml-model)