---
title: CreateSecurityServiceRequest
slug: /main-concepts/metadata-standard/schemas/api/services/createsecurityservice
collate: true
---

# CreateSecurityServiceRequest

*Create Security Service Request.*

## Properties

- **`name`**: Name that identifies this security service. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this security service.
- **`description`**: Description of a security service instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`serviceType`**: Refer to *[../../entity/services/securityService.json#/definitions/securityServiceType](#/../entity/services/securityService.json#/definitions/securityServiceType)*.
- **`connection`**: Refer to *[../../entity/services/securityService.json#/definitions/securityConnection](#/../entity/services/securityService.json#/definitions/securityConnection)*.
- **`tags`** *(array)*: Tags for this Security Service. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`owners`**: Owners of this security service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Security Service belongs to.
- **`dataProducts`**: List of fully qualified names of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.

*This schema defines the Security Service entity, such as Apache Ranger.* 