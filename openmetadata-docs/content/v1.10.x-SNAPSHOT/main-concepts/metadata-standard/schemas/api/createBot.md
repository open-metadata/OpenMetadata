---
title: createBot
slug: /main-concepts/metadata-standard/schemas/api/createbot
---

# createBot

*Create bot API request*

## Properties

- **`name`**: Name of the bot. Refer to *../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'FirstName LastName'.
- **`botUser`** *(string)*: Bot user name created for this bot on behalf of which the bot performs all the operations, such as updating description, responding on the conversation threads, etc.
- **`description`** *(string)*: Description of the bot.
- **`provider`**: Refer to *../type/basic.json#/definitions/providerType*.
- **`domains`** *(array)*: Fully qualified names of the domains the Bot belongs to.
  - **Items** *(string)*


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
