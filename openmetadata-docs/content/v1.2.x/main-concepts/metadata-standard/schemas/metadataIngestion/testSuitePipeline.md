---
title: testSuitePipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/testsuitepipeline
---

# TestSuitePipeline

*TestSuite Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/testSuiteConfigType](#definitions/testSuiteConfigType)*. Default: `"TestSuite"`.
- **`entityFullyQualifiedName`**: Fully qualified name of the entity to be tested. Refer to *[../type/basic.json#/definitions/fullyQualifiedEntityName](#/type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`profileSample`** *(number)*: Percentage of data or no. of rows we want to execute the profiler and tests on. Default: `null`.
- **`profileSampleType`**: Refer to *[../entity/data/table.json#/definitions/profileSampleType](#/entity/data/table.json#/definitions/profileSampleType)*.
## Definitions

- <a id="definitions/testSuiteConfigType"></a>**`testSuiteConfigType`** *(string)*: Pipeline Source Config Metadata Pipeline type. Must be one of: `["TestSuite"]`. Default: `"TestSuite"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
