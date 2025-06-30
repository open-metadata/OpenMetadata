---
title: Reaction Schema | OpenMetadata Reaction Schema Information
slug: /main-concepts/metadata-standard/schemas/type/reaction
---

# Reaction

*This schema defines the reaction to an entity or a conversation in the activity feeds.*

## Properties

- **`reactionType`**: Refer to *[#/definitions/reactionType](#definitions/reactionType)*.
- **`user`**: User who reacted. Refer to *[entityReference.json](#tityReference.json)*.
## Definitions

- **`reactionList`** *(array)*: Default: `null`.
  - **Items**: Refer to *[reaction.json](#action.json)*.
- **`reactionType`** *(string)*: Type of reaction. Must be one of: `["thumbsUp", "thumbsDown", "hooray", "laugh", "confused", "heart", "rocket", "eyes"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
