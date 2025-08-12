---
title: Settings | OpenMetadata Settings Configuration
description: Connect Settings to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
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
    - : Refer to *[../configuration/profilerConfiguration.json](#/configuration/profilerConfiguration.json)*.
    - : Refer to *[../configuration/searchSettings.json](#/configuration/searchSettings.json)*.
    - : Refer to *[../configuration/assetCertificationSettings.json](#/configuration/assetCertificationSettings.json)*.
    - : Refer to *[../configuration/lineageSettings.json](#/configuration/lineageSettings.json)*.
    - : Refer to *[../configuration/workflowSettings.json](#/configuration/workflowSettings.json)*.
## Definitions

- **`settingType`** *(string)*: This schema defines all possible filters enum in OpenMetadata. Must be one of: `["authorizerConfiguration", "authenticationConfiguration", "jwtTokenConfiguration", "elasticsearch", "eventHandlerConfiguration", "airflowConfiguration", "fernetConfiguration", "slackEventPublishers", "secretsManagerConfiguration", "sandboxModeEnabled", "slackChat", "emailConfiguration", "customUiThemePreference", "loginConfiguration", "slackAppConfiguration", "slackBot", "slackInstaller", "slackState", "profilerConfiguration", "searchSettings", "assetCertificationSettings", "lineageSettings", "workflowSettings"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
