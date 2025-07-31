---
title: Create Security Service | OpenMetadata Security Service
description: Create a security service entity to manage metadata for security systems and access control platforms.
slug: /main-concepts/metadata-standard/schemas/api/services/createsecurityservice
collate: true
---

# CreateSecurityServiceRequest

*Create Security Service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this security service. It could be title or label from the source services.
- **`description`**: Description of security service entity. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`serviceType`**: Refer to *[../../entity/services/securityService.json#/definitions/securityServiceType](#/../entity/services/securityService.json#/definitions/securityServiceType)*.
- **`connection`**: Refer to *[../../entity/services/securityService.json#/definitions/securityConnection](#/../entity/services/securityService.json#/definitions/securityConnection)*.
- **`tags`** *(array)*: Tags for this Security Service. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`owners`**: Owners of this security service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`domains`** *(array)*: Fully qualified names of the domains the Search Service belongs to.
  - **Items** *(string)*
- **`ingestionRunner`**: The ingestion agent responsible for executing the ingestion pipeline. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
