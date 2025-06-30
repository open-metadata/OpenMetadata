---
title: databaseConnectionConfig
slug: /main-concepts/metadata-standard/schemas/type/databaseconnectionconfig
---

# DatabaseConnectionConfig

*Database Connection Config to capture connection details to a database service.*

## Properties

- **`username`** *(string)*: username to connect  to the data source.
- **`password`** *(string)*: password to connect  to the data source.
- **`hostPort`** *(string)*: Host and port of the data source.
- **`database`** *(string)*: Database of the data source.
- **`schema`** *(string)*: schema of the data source.
- **`includeViews`** *(boolean)*: optional configuration to turn off fetching metadata for views. Default: `true`.
- **`includeTables`** *(boolean)*: Optional configuration to turn off fetching metadata for tables. Default: `true`.
- **`generateSampleData`** *(boolean)*: Turn on/off collecting sample data. Default: `true`.
- **`sampleDataQuery`** *(string)*: query to generate sample data. Default: `"select * from {}.{} limit 50"`.
- **`enableDataProfiler`** *(boolean)*: Run data profiler as part of ingestion to get table profile data. Default: `false`.
- **`includeFilterPattern`** *(array)*: Regex to only fetch tables or databases that matches the pattern. Default: `null`.
  - **Items** *(string)*
- **`excludeFilterPattern`** *(array)*: Regex exclude tables or databases that matches the pattern. Default: `null`.
  - **Items** *(string)*


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
