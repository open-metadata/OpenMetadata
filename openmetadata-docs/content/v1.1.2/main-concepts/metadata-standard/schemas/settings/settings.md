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

- **`settingType`** *(string)*: This schema defines all possible filters enum in OpenMetadata. Must be one of: `['authorizerConfiguration', 'authenticationConfiguration', 'jwtTokenConfiguration', 'elasticsearch', 'eventHandlerConfiguration', 'airflowConfiguration', 'fernetConfiguration', 'slackEventPublishers', 'secretsManagerConfiguration', 'sandboxModeEnabled', 'slackChat', 'emailConfiguration', 'customLogoConfiguration', 'slackAppConfiguration', 'slackBot', 'slackInstaller']`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
