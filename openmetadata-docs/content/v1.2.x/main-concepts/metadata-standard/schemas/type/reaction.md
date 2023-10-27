---
title: reaction
slug: /main-concepts/metadata-standard/schemas/type/reaction
---

# Reaction

*This schema defines the reaction to an entity or a conversation in the activity feeds.*

## Properties

- **`reactionType`**: Refer to *[#/definitions/reactionType](#definitions/reactionType)*.
- **`user`**: User who reacted. Refer to *[entityReference.json](#tityReference.json)*.
## Definitions

- <a id="definitions/reactionList"></a>**`reactionList`** *(array)*: Default: `null`.
  - **Items**: Refer to *[reaction.json](#action.json)*.
- <a id="definitions/reactionType"></a>**`reactionType`** *(string)*: Type of reaction. Must be one of: `["thumbsUp", "thumbsDown", "hooray", "laugh", "confused", "heart", "rocket", "eyes"]`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
