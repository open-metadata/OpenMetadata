---
title: reaction
slug: /main-concepts/metadata-standard/schemas/type/reaction
---

# Reaction

*This schema defines the reaction to an entity or a conversation in the activity feeds.*

## Properties

- **`reactionType`**: Refer to *#/definitions/reactionType*.
- **`user`**: User who reacted. Refer to *entityReference.json*.
## Definitions

- **`reactionList`** *(array)*: Default: `None`.
  - **Items**: Refer to *reaction.json*.
- **`reactionType`** *(string)*: Type of reaction. Must be one of: `['thumbsUp', 'thumbsDown', 'hooray', 'laugh', 'confused', 'heart', 'rocket', 'eyes']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
