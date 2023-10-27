---
title: createAppRequest
slug: /main-concepts/metadata-standard/schemas/entity/applications/createapprequest
---

# CreateApp

*This schema defines the create applications request for Open-Metadata.*

## Properties

- **`name`**: Name of the Application. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`owner`**: Owner of this workflow. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*. Default: `null`.
- **`bot`**: Fqn of Bot Associated with this application. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*. Default: `null`.
- **`appConfiguration`**: Application Configuration object.
- **`appSchedule`**: Refer to *[./app.json#/definitions/appSchedule](#app.json#/definitions/appSchedule)*.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
