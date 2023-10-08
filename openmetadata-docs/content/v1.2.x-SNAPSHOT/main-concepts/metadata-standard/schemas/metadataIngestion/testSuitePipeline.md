---
title: testSuitePipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/testsuitepipeline
---

# TestSuitePipeline

*TestSuite Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/testSuiteConfigType*. Default: `TestSuite`.
- **`entityFullyQualifiedName`**: Fully qualified name of the entity to be tested. Refer to *../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`profileSample`** *(number)*: Percentage of data or no. of rows we want to execute the profiler and tests on. Default: `None`.
- **`profileSampleType`**: Refer to *../entity/data/table.json#definitions/profileSampleType*.
## Definitions

- **`testSuiteConfigType`** *(string)*: Pipeline Source Config Metadata Pipeline type. Must be one of: `['TestSuite']`. Default: `TestSuite`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
