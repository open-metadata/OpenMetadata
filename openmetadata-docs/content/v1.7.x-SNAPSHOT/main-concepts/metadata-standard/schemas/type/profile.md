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

- **`messagingProvider`** *(object)*: Holds the Subscription Config for different types. Cannot contain additional properties.
  - **`slack`**: Refer to *[../entity/events/webhook.json](#/entity/events/webhook.json)*.
  - **`msTeams`**: Refer to *[../entity/events/webhook.json](#/entity/events/webhook.json)*.
  - **`gChat`**: Refer to *[../entity/events/webhook.json](#/entity/events/webhook.json)*.
  - **`generic`**: Refer to *[../entity/events/webhook.json](#/entity/events/webhook.json)*.
- **`imageList`** *(object)*: Links to a list of images of varying resolutions/sizes. Cannot contain additional properties.
  - **`image`** *(string, format: uri)*
  - **`image24`** *(string, format: uri)*
  - **`image32`** *(string, format: uri)*
  - **`image48`** *(string, format: uri)*
  - **`image72`** *(string, format: uri)*
  - **`image192`** *(string, format: uri)*
  - **`image512`** *(string, format: uri)*


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
