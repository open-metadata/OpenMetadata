---
title: testSuitePipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/testsuitepipeline
---

# TestSuitePipeline

*TestSuite Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/testSuiteConfigType*. Default: `TestSuite`.
- **`entityFullyQualifiedName`**: Fully qualified name of the entity to be tested, if we're working with a basic suite. Refer to *../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`serviceConnections`** *(array)*: Service connections to be used for the logical test suite. Default: `None`.
  - **Items**: Refer to *#/definitions/serviceConnections*.
- **`profileSample`** *(number)*: Percentage of data or no. of rows we want to execute the profiler and tests on. Default: `None`.
- **`profileSampleType`**: Refer to *../entity/data/table.json#/definitions/profileSampleType*.
- **`samplingMethodType`**: Refer to *../entity/data/table.json#/definitions/samplingMethodType*.
- **`testCases`** *(array)*: List of test cases to be executed on the entity. If null, all test cases will be executed. Default: `None`.
  - **Items**: Refer to *../type/basic.json#/definitions/testCaseEntityName*.
## Definitions

- **`testSuiteConfigType`** *(string)*: Pipeline Source Config Metadata Pipeline type. Must be one of: `['TestSuite']`. Default: `TestSuite`.
- **`serviceConnections`** *(object)*: Service connections available for the logical test suite. Cannot contain additional properties.
  - **`serviceName`** *(string)*
  - **`serviceConnection`**: Connection configuration for the source. ex: mysql , tableau connection. Refer to *../entity/services/connections/serviceConnection.json#/definitions/serviceConnection*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
