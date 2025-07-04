---
title: Create App Request | OpenMetadata App Creation
slug: /main-concepts/metadata-standard/schemas/entity/applications/createapprequest
---

# CreateAppRequest

*This schema defines the create applications request for Open-Metadata.*

## Properties

- **`name`**: Name of the Application. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name for the application.
- **`description`**: Description of the Application. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`owners`**: Owners of this workflow. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`bot`**: Fqn of Bot Associated with this application. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*. Default: `null`.
- **`appConfiguration`**: Application Configuration object.
- **`appSchedule`**: Refer to *[./app.json#/definitions/appSchedule](#app.json#/definitions/appSchedule)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Table belongs to.
- **`supportsInterrupt`** *(boolean)*: If the app run can be interrupted as part of the execution. Default: `false`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
