---
title: autoPilotAppConfig
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/internal/autopilotappconfig
---

# AutoPilotAppConfig

*Configuration for the AutoPilot Application.*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/autoPilotAppType*. Default: `AutoPilotApplication`.
- **`active`** *(boolean)*: Whether the AutoPilot Workflow should be active or not. Default: `True`.
- **`entityLink`**: Service Entity Link for which to trigger the application. Refer to *../../../../type/basic.json#/definitions/entityLink*.
## Definitions

- **`autoPilotAppType`** *(string)*: Application type. Must be one of: `['AutoPilotApplication']`. Default: `AutoPilotApplication`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
