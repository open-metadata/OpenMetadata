---
title: threadCount
slug: /main-concepts/metadata-standard/schemas/api/feed/threadcount
---

# Count of threads related to an entity

*This schema defines the type for reporting the count of threads related to an entity.*

## Properties

- **`conversationCount`** *(integer)*: Total count of all the threads of type Conversation. Minimum: `0`.
- **`openTaskCount`** *(integer)*: Total count of all the open tasks. Minimum: `0`.
- **`closedTaskCount`** *(integer)*: Total count of all the tasks. Minimum: `0`.
- **`totalTaskCount`** *(integer)*: Total count of all the tasks. Minimum: `0`.
- **`mentionCount`** *(integer)*: Total count of all the mentions of a user. Minimum: `0`.
- **`totalAnnouncementCount`** *(integer)*: Total count of all the announcements associated with the entity. Minimum: `0`.
- **`activeAnnouncementCount`** *(integer)*: Total count of all the active announcements associated with the entity. Minimum: `0`.
- **`inactiveAnnouncementCount`** *(integer)*: Total count of all the inactive announcements associated with the entity. Minimum: `0`.
- **`entityLink`**: Refer to *../../type/basic.json#/definitions/entityLink*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
