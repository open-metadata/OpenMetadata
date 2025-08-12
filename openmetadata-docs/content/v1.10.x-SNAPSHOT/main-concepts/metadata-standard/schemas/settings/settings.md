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

- **`settingType`** *(string)*: This schema defines all possible filters enum in OpenMetadata. Must be one of: `['authorizerConfiguration', 'authenticationConfiguration', 'jwtTokenConfiguration', 'elasticsearch', 'eventHandlerConfiguration', 'airflowConfiguration', 'fernetConfiguration', 'slackEventPublishers', 'secretsManagerConfiguration', 'sandboxModeEnabled', 'slackChat', 'emailConfiguration', 'openMetadataBaseUrlConfiguration', 'customUiThemePreference', 'loginConfiguration', 'slackAppConfiguration', 'slackBot', 'slackInstaller', 'slackState', 'profilerConfiguration', 'searchSettings', 'assetCertificationSettings', 'lineageSettings', 'workflowSettings', 'entityRulesSettings', 'scimConfiguration']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
