---
title: createAppRequest
slug: /main-concepts/metadata-standard/schemas/entity/applications/createapprequest
---

# CreateAppRequest

*This schema defines the create applications request for Open-Metadata.*

## Properties

- **`name`**: Name of the Application. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name for the application.
- **`description`**: Description of the Application. Refer to *../../type/basic.json#/definitions/markdown*.
- **`owners`**: Owners of this workflow. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`bot`**: Fqn of Bot Associated with this application. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*. Default: `None`.
- **`appConfiguration`**: Application Configuration object.
- **`appSchedule`**: Refer to *./app.json#/definitions/appSchedule*.
- **`domains`** *(array)*: Fully qualified names of the domains the Application belongs to.
  - **Items** *(string)*
- **`supportsInterrupt`** *(boolean)*: If the app run can be interrupted as part of the execution. Default: `False`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
