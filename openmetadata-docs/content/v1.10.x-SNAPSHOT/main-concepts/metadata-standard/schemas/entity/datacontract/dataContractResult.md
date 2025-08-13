---
title: dataContractResult
slug: /main-concepts/metadata-standard/schemas/entity/datacontract/datacontractresult
---

# DataContractResult

*Schema to capture data contract execution results over time.*

## Properties

- **`id`**: Unique Data Contract validation execution identifier of this data contract result instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`dataContractFQN`**: Fully qualified name of the data contract. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`timestamp`**: Timestamp when the data contract was executed. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`contractExecutionStatus`**: Overall status of the contract execution. Refer to *../../type/contractExecutionStatus.json*.
- **`result`** *(string)*: Detailed result of the data contract execution.
- **`schemaValidation`**: Schema validation details. Refer to *schemaValidation.json*. Default: `None`.
- **`semanticsValidation`**: Semantics validation details. Refer to *semanticsValidation.json*. Default: `None`.
- **`qualityValidation`**: Quality expectations validation details. Refer to *qualityValidation.json*. Default: `None`.
- **`slaValidation`**: SLA validation details. Refer to *slaValidation.json*. Default: `None`.
- **`incidentId`**: Incident ID if the contract execution failed and an incident was created. Refer to *../../type/basic.json#/definitions/uuid*.
- **`executionTime`**: Time taken to execute the contract validation in milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
