---
title: cloudConfig
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


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
