---
title: createDataContract
slug: /main-concepts/metadata-standard/schemas/api/data/createdatacontract
---

# CreateDataContractRequest

*Request to create a Data Contract entity.*

## Properties

- **`name`**: Name of the data contract. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display name of the data contract.
- **`description`**: Description of the data contract. Refer to *../../type/basic.json#/definitions/markdown*.
- **`status`**: Refer to *../../entity/data/dataContract.json#/definitions/contractStatus*. Default: `Draft`.
- **`entity`**: Reference to the data entity (table, topic, etc.) this contract applies to. Refer to *../../type/entityReference.json*.
- **`schema`** *(array)*: Schema definition for the data contract. Default: `None`.
  - **Items**: Refer to *../../entity/data/table.json#/definitions/column*.
- **`semantics`** *(array)*: Semantics rules defined in the data contract. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/semanticsRule*.
- **`qualityExpectations`** *(array)*: Quality expectations defined in the data contract. Default: `None`.
  - **Items**: Refer to *../../type/entityReference.json*.
- **`owners`**: Owners of this data contract. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`reviewers`**: User references of the reviewers for this data contract. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`effectiveFrom`**: Date from which this data contract is effective. Refer to *../../type/basic.json#/definitions/dateTime*. Default: `None`.
- **`effectiveUntil`**: Date until which this data contract is effective. Refer to *../../type/basic.json#/definitions/dateTime*. Default: `None`.
- **`sourceUrl`**: Source URL of the data contract. Refer to *../../type/basic.json#/definitions/sourceUrl*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
