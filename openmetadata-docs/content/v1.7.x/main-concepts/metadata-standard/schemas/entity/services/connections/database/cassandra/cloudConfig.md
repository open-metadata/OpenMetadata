---
title: Cassandra Cloud Config | OpenMetadata Cassandra Cloud
description: Get started with cloudconfig. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/cassandra/cloudconfig
---

# Cloud Config

*Configuration for connecting to DataStax Astra DB in the cloud.*

## Properties

- **`cloudConfig`** *(object)*: Configuration for connecting to DataStax Astra DB in the cloud.
  - **`connectTimeout`** *(integer)*: Timeout in seconds for establishing new connections to Cassandra.
  - **`requestTimeout`** *(integer)*: Timeout in seconds for individual Cassandra requests.
  - **`token`** *(string)*: The Astra DB application token used for authentication.
  - **`secureConnectBundle`** *(string)*: File path to the Secure Connect Bundle (.zip) used for a secure connection to DataStax Astra DB.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
