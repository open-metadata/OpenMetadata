---
title: eventSubscription
slug: /main-concepts/metadata-standard/schemas/events/eventsubscription
---

# EventSubscription

*This schema defines the EventSubscription entity. An Event Subscription has trigger, filters and Subscription*

## Properties

- **`id`**: Unique identifier that identifies this Event Subscription. Refer to *../type/basic.json#/definitions/uuid*.
- **`name`**: Name that uniquely identifies this Event Subscription. Refer to *../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName that uniquely identifies a Event Subscription. Refer to *../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display name for this Event Subscription.
- **`description`**: A short description of the Event Subscription, comprehensible to regular users. Refer to *../type/basic.json#/definitions/markdown*.
- **`owner`**: Owner of this Event Subscription. Refer to *../type/entityReference.json*. Default: `None`.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../type/basic.json#/definitions/href*.
- **`version`**: Metadata version of the Event Subscription. Refer to *../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the Event Subscription in Unix epoch time milliseconds. Refer to *../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`changeDescription`**: Change that led to this version of the Event Subscription. Refer to *../type/entityHistory.json#/definitions/changeDescription*.
- **`alertType`**: Type of Alert. Refer to *#/definitions/alertType*.
- **`trigger`**: Trigger information for Alert. Refer to *#/definitions/trigger*.
- **`filteringRules`**: Set of rules that the Event Subscription Contains to allow conditional control for alerting. Refer to *#/definitions/filteringRules*.
- **`subscriptionType`**: Refer to *#/definitions/subscriptionType*.
- **`subscriptionConfig`**: Refer to *#/definitions/subscriptionConfig*.
- **`enabled`** *(boolean)*: Is the event Subscription enabled. Default: `True`.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 10). Default: `10`.
- **`timeout`** *(integer)*: Connection timeout in seconds. (Default 10s). Default: `10`.
- **`readTimeout`** *(integer)*: Read timeout in seconds. (Default 12s). Default: `12`.
- **`statusDetails`**: Refer to *#/definitions/subscriptionStatus*.
- **`provider`**: Refer to *../type/basic.json#/definitions/providerType*.
## Definitions

- **`triggerType`** *(string)*: Trigger Configuration for Alerts. Must be one of: `['RealTime', 'Scheduled']`. Default: `RealTime`.
- **`alertType`** *(string)*: Type of Alerts supported. Must be one of: `['ChangeEvent', 'DataInsightReport', 'Task/Conversation/Announcement']`. Default: `ChangeEvent`.
- **`subscriptionType`** *(string)*: Subscription Endpoint Type. Must be one of: `['GenericWebhook', 'SlackWebhook', 'MsTeamsWebhook', 'GChatWebhook', 'Email', 'ActivityFeed', 'DataInsight']`.
- **`subscription`** *(object)*: Subscription which has a type and the config. Cannot contain additional properties.
  - **`subscriptionType`**: Refer to *#/definitions/subscriptionType*.
  - **`subscriptionName`** *(string)*: Name for the subscription.
  - **`subscriptionConfig`**: Refer to *#/definitions/subscriptionConfig*.
- **`subscriptionConfig`**
- **`status`** *(string)*: Status is `disabled`, when eventSubscription was created with `enabled` set to false and it never started publishing events. Status is `active` when eventSubscription is normally functioning and 200 OK response was received for callback notification. Status is `failed` on bad callback URL, connection failures, `1xx`, and `3xx` response was received for callback notification. Status is `awaitingRetry` when previous attempt at callback timed out or received `4xx`, `5xx` response. Status is `retryLimitReached` after all retries fail. Must be one of: `['disabled', 'failed', 'retryLimitReached', 'awaitingRetry', 'active']`.
- **`subscriptionStatus`** *(object)*: Subscription Current Status. Cannot contain additional properties.
  - **`status`**: Refer to *#/definitions/status*.
  - **`lastSuccessfulAt`**: Last non-successful callback time in UNIX UTC epoch time in milliseconds. Refer to *../type/basic.json#/definitions/timestamp*.
  - **`lastFailedAt`**: Last non-successful callback time in UNIX UTC epoch time in milliseconds. Refer to *../type/basic.json#/definitions/timestamp*.
  - **`lastFailedStatusCode`** *(integer)*: Last non-successful activity response code received during callback.
  - **`lastFailedReason`** *(string)*: Last non-successful activity response reason received during callback.
  - **`nextAttempt`**: Next retry will be done at this time in Unix epoch time milliseconds. Only valid is `status` is `awaitingRetry`. Refer to *../type/basic.json#/definitions/timestamp*.
  - **`timestamp`**: Refer to *../type/basic.json#/definitions/timestamp*.
- **`filteringRules`** *(object)*: Filtering Rules for Event Subscription. Cannot contain additional properties.
  - **`resources`** *(array)*: Defines a list of resources that triggers the Event Subscription, Eg All, User, Teams etc.
    - **Items** *(string)*
  - **`rules`** *(array)*: A set of filter rules associated with the Alert.
    - **Items**: Refer to *./eventFilterRule.json*.
- **`trigger`** *(object)*: Trigger Configuration for Alerts. Cannot contain additional properties.
  - **`triggerType`**: Refer to *#/definitions/triggerType*.
  - **`scheduleInfo`** *(string)*: Schedule Info. Must be one of: `['Daily', 'Weekly', 'Monthly', 'Custom']`. Default: `Weekly`.
  - **`cronExpression`** *(string)*: Cron Expression in case of Custom scheduled Trigger.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
