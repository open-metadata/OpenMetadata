---
title: testSuitePipeline | OpenMetadata Test Suite Pipeline
description: Connect Testsuitepipeline to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/metadataingestion/testsuitepipeline
---

# TestSuitePipeline

*TestSuite Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/testSuiteConfigType](#definitions/testSuiteConfigType)*. Default: `"TestSuite"`.
- **`entityFullyQualifiedName`**: Fully qualified name of the entity to be tested, if we're working with a basic suite. Refer to *[../type/basic.json#/definitions/fullyQualifiedEntityName](#/type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`serviceConnections`** *(array)*: Service connections to be used for the logical test suite. Default: `null`.
  - **Items**: Refer to *[#/definitions/serviceConnections](#definitions/serviceConnections)*.
- **`profileSample`** *(number)*: Percentage of data or no. of rows we want to execute the profiler and tests on. Default: `null`.
- **`profileSampleType`**: Refer to *[../entity/data/table.json#/definitions/profileSampleType](#/entity/data/table.json#/definitions/profileSampleType)*.
- **`samplingMethodType`**: Refer to *[../entity/data/table.json#/definitions/samplingMethodType](#/entity/data/table.json#/definitions/samplingMethodType)*.
- **`testCases`** *(array)*: List of test cases to be executed on the entity. If null, all test cases will be executed. Default: `null`.
  - **Items**: Refer to *[../type/basic.json#/definitions/testCaseEntityName](#/type/basic.json#/definitions/testCaseEntityName)*.
## Definitions

- **`testSuiteConfigType`** *(string)*: Pipeline Source Config Metadata Pipeline type. Must be one of: `["TestSuite"]`. Default: `"TestSuite"`.
- **`serviceConnections`** *(object)*: Service connections available for the logical test suite. Cannot contain additional properties.
  - **`serviceName`** *(string, required)*
  - **`serviceConnection`**: Connection configuration for the source. ex: mysql , tableau connection. Refer to *[../entity/services/connections/serviceConnection.json#/definitions/serviceConnection](#/entity/services/connections/serviceConnection.json#/definitions/serviceConnection)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
