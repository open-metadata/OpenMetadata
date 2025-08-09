---
title: report
slug: /main-concepts/metadata-standard/schemas/entity/data/report
---

# Report

*This schema defines the Report entity. `Reports` are static information computed from data periodically that includes data in text, table, and visual form.*

## Properties

- **`id`**: Unique identifier that identifies this report. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this report instance uniquely. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: A unique name that identifies a report in the format 'ServiceName.ReportName'. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this report. It could be title or label from the source services.
- **`description`**: Description of this report instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this report. Refer to *../../type/basic.json#/definitions/href*.
- **`owners`**: Owners of this Report. Refer to *../../type/entityReferenceList.json*.
- **`service`**: Link to service where this report is hosted in. Refer to *../../type/entityReference.json*.
- **`usageSummary`**: Latest usage information for this database. Refer to *../../type/usageDetails.json*. Default: `None`.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`votes`**: Votes on the entity. Refer to *../../type/votes.json*.
- **`domains`**: Domains the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *../../type/entityReferenceList.json*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
