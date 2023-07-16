---
title: profile
slug: /main-concepts/metadata-standard/schemas/type/profile
---

# Profile

*This schema defines the type for a profile of a user, team, or organization.*

## Properties

- **`images`**: Refer to *[#/definitions/imageList](#definitions/imageList)*.
- **`subscription`**: Refer to *[#/definitions/messagingProvider](#definitions/messagingProvider)*.
## Definitions

- <a id="definitions/messagingProvider"></a>**`messagingProvider`** *(object)*: Holds the Subscription Config for different types. Cannot contain additional properties.
  - **`slack`**: Refer to *[../entity/events/webhook.json](#/entity/events/webhook.json)*.
  - **`msTeams`**: Refer to *[../entity/events/webhook.json](#/entity/events/webhook.json)*.
  - **`gChat`**: Refer to *[../entity/events/webhook.json](#/entity/events/webhook.json)*.
  - **`generic`**: Refer to *[../entity/events/webhook.json](#/entity/events/webhook.json)*.
- <a id="definitions/imageList"></a>**`imageList`** *(object)*: Links to a list of images of varying resolutions/sizes. Cannot contain additional properties.
  - **`image`** *(string)*
  - **`image24`** *(string)*
  - **`image32`** *(string)*
  - **`image48`** *(string)*
  - **`image72`** *(string)*
  - **`image192`** *(string)*
  - **`image512`** *(string)*


Documentation file automatically generated at 2023-07-16 19:59:36.193714.
