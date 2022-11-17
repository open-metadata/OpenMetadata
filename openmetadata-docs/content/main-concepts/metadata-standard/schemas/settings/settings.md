---
title: settings
slug: /main-concepts/metadata-standard/schemas/settings/settings
---

# Settings

*This schema defines the Settings. A Settings represents a generic Setting.*

## Properties

- **`config_type`**: Unique identifier that identifies an entity instance. Refer to *#/definitions/settingType*.
- **`config_value`**
## Definitions

- **`settingType`** *(string)*: This schema defines all possible filters enum in OpenMetadata. Must be one of: `['authorizerConfiguration', 'authenticationConfiguration', 'jwtTokenConfiguration', 'elasticsearch', 'eventHandlerConfiguration', 'airflowConfiguration', 'fernetConfiguration', 'slackEventPublishers', 'activityFeedFilterSetting', 'secretsManagerConfiguration', 'sandboxModeEnabled', 'slackChat', 'taskNotificationConfiguration', 'testResultNotificationConfiguration']`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
