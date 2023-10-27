---
title: settings
slug: /main-concepts/metadata-standard/schemas/settings/settings
---

# Settings

*This schema defines the Settings. A Settings represents a generic Setting.*

## Properties

- **`config_type`**: Unique identifier that identifies an entity instance. Refer to *[#/definitions/settingType](#definitions/settingType)*.
- **`config_value`**
  - **One of**
    - : Refer to *[../configuration/pipelineServiceClientConfiguration.json](#/configuration/pipelineServiceClientConfiguration.json)*.
    - : Refer to *[../configuration/authenticationConfiguration.json](#/configuration/authenticationConfiguration.json)*.
    - : Refer to *[../configuration/authorizerConfiguration.json](#/configuration/authorizerConfiguration.json)*.
    - : Refer to *[../configuration/elasticSearchConfiguration.json](#/configuration/elasticSearchConfiguration.json)*.
    - : Refer to *[../configuration/eventHandlerConfiguration.json](#/configuration/eventHandlerConfiguration.json)*.
    - : Refer to *[../configuration/fernetConfiguration.json](#/configuration/fernetConfiguration.json)*.
    - : Refer to *[../configuration/jwtTokenConfiguration.json](#/configuration/jwtTokenConfiguration.json)*.
    - : Refer to *[../configuration/taskNotificationConfiguration.json](#/configuration/taskNotificationConfiguration.json)*.
    - : Refer to *[../email/smtpSettings.json](#/email/smtpSettings.json)*.
    - : Refer to *[../configuration/slackAppConfiguration.json](#/configuration/slackAppConfiguration.json)*.
## Definitions

- <a id="definitions/settingType"></a>**`settingType`** *(string)*: This schema defines all possible filters enum in OpenMetadata. Must be one of: `["authorizerConfiguration", "authenticationConfiguration", "jwtTokenConfiguration", "elasticsearch", "eventHandlerConfiguration", "airflowConfiguration", "fernetConfiguration", "slackEventPublishers", "secretsManagerConfiguration", "sandboxModeEnabled", "slackChat", "emailConfiguration", "customLogoConfiguration", "slackAppConfiguration", "slackBot", "slackInstaller"]`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
