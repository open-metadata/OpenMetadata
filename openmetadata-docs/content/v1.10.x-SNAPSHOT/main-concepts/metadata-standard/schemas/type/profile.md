---
title: profile
slug: /main-concepts/metadata-standard/schemas/type/profile
---

# Profile

*This schema defines the type for a profile of a user, team, or organization.*

## Properties

- **`images`**: Refer to *#/definitions/imageList*.
- **`subscription`**: Refer to *#/definitions/messagingProvider*.
## Definitions

- **`messagingProvider`** *(object)*: Holds the Subscription Config for different types. Cannot contain additional properties.
  - **`slack`**: Refer to *../entity/events/webhook.json*.
  - **`msTeams`**: Refer to *../entity/events/webhook.json*.
  - **`gChat`**: Refer to *../entity/events/webhook.json*.
  - **`generic`**: Refer to *../entity/events/webhook.json*.
- **`imageList`** *(object)*: Links to a list of images of varying resolutions/sizes. Cannot contain additional properties.
  - **`image`** *(string)*
  - **`image24`** *(string)*
  - **`image32`** *(string)*
  - **`image48`** *(string)*
  - **`image72`** *(string)*
  - **`image192`** *(string)*
  - **`image512`** *(string)*


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
