---
title: Create Bot API | OpenMetadata Bot Creation API
slug: /main-concepts/metadata-standard/schemas/api/createbot
---

# createBot

*Create bot API request*

## Properties

- **`name`**: Name of the bot. Refer to *[../type/basic.json#/definitions/entityName](#/type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'FirstName LastName'.
- **`botUser`** *(string)*: Bot user name created for this bot on behalf of which the bot performs all the operations, such as updating description, responding on the conversation threads, etc.
- **`description`** *(string)*: Description of the bot.
- **`provider`**: Refer to *[../type/basic.json#/definitions/providerType](#/type/basic.json#/definitions/providerType)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Table belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
