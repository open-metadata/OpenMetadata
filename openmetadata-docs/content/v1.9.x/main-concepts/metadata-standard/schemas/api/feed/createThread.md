---
title: Create Thread API | OpenMetadata Thread API
description: Start a new discussion thread related to a specific entity, topic, or question for collaborative resolution.
slug: /main-concepts/metadata-standard/schemas/api/feed/createthread
---

# CreateThreadRequest

*Create thread request*

## Properties

- **`message`** *(string)*: Message.
- **`from`** *(string)*: Name of the User (regular user or bot) posting the message.
- **`addressedTo`**: User or team this thread is addressed to in format <#E::{entities}::{entityName}::{field}::{fieldValue}. Refer to *[../../type/basic.json#/definitions/entityLink](#/../type/basic.json#/definitions/entityLink)*.
- **`about`**: Data asset about which this thread is created for with format <#E::{entities}::{entityType}::{field}::{fieldValue}. Refer to *[../../type/basic.json#/definitions/entityLink](#/../type/basic.json#/definitions/entityLink)*.
- **`type`**: Refer to *[../../entity/feed/thread.json#/definitions/threadType](#/../entity/feed/thread.json#/definitions/threadType)*.
- **`taskDetails`**: Refer to *[#/definitions/createTaskDetails](#definitions/createTaskDetails)*.
- **`announcementDetails`**: Refer to *[../../entity/feed/thread.json#/definitions/announcementDetails](#/../entity/feed/thread.json#/definitions/announcementDetails)*.
- **`chatbotDetails`**: Details about the Chatbot conversation. This is only applicable if thread is of type Chatbot. Refer to *[../../entity/feed/thread.json#/definitions/chatbotDetails](#/../entity/feed/thread.json#/definitions/chatbotDetails)*.
## Definitions

- **`createTaskDetails`** *(object)*: Details about the task. This is only applicable if thread is of type task. Cannot contain additional properties.
  - **`type`**: Refer to *[../../entity/feed/thread.json#/definitions/taskType](#/../entity/feed/thread.json#/definitions/taskType)*.
  - **`assignees`**: List of users or teams the task is assigned to. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
  - **`oldValue`** *(string)*: The value of old object for which the task is created.
  - **`suggestion`** *(string)*: The suggestion object for the task provided by the creator.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
