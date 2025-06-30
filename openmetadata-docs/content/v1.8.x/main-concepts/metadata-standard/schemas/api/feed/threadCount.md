---
title: Thread Count API | OpenMetadata Thread Count
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
- **`entityLink`**: Refer to *[../../type/basic.json#/definitions/entityLink](#/../type/basic.json#/definitions/entityLink)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
