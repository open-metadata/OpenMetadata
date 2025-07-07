---
title: eventSubscription | OpenMetadata Event Subscription
slug: /main-concepts/metadata-standard/schemas/events/eventsubscription
---

# EventSubscription

*This schema defines the EventSubscription entity. An Event Subscription has trigger, filters and Subscription*

## Properties

- **`id`**: Unique identifier that identifies this Event Subscription. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`name`**: Name that uniquely identifies this Event Subscription. Refer to *[../type/basic.json#/definitions/entityName](#/type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName that uniquely identifies a Event Subscription. Refer to *[../type/basic.json#/definitions/fullyQualifiedEntityName](#/type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display name for this Event Subscription.
- **`description`**: A short description of the Event Subscription, comprehensible to regular users. Refer to *[../type/basic.json#/definitions/markdown](#/type/basic.json#/definitions/markdown)*.
- **`owners`**: Owners of this Event Subscription. Refer to *[../type/entityReferenceList.json](#/type/entityReferenceList.json)*. Default: `null`.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../type/basic.json#/definitions/href](#/type/basic.json#/definitions/href)*.
- **`version`**: Metadata version of the Event Subscription. Refer to *[../type/entityHistory.json#/definitions/entityVersion](#/type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the Event Subscription in Unix epoch time milliseconds. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`changeDescription`**: Change that led to this version of the Event Subscription. Refer to *[../type/entityHistory.json#/definitions/changeDescription](#/type/entityHistory.json#/definitions/changeDescription)*.
- **`alertType`**: Type of Alert. Refer to *[#/definitions/alertType](#definitions/alertType)*.
- **`trigger`**: Trigger information for Alert. Refer to *[#/definitions/trigger](#definitions/trigger)*.
- **`filteringRules`**: Set of rules that the Event Subscription Contains to allow conditional control for alerting. Refer to *[#/definitions/filteringRules](#definitions/filteringRules)*.
- **`destinations`** *(array)*: Destination Config.
  - **Items**: Refer to *[#/definitions/destination](#definitions/destination)*.
- **`enabled`** *(boolean)*: Is the event Subscription enabled. Default: `true`.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 100). Default: `100`.
- **`provider`**: Refer to *[../type/basic.json#/definitions/providerType](#/type/basic.json#/definitions/providerType)*.
- **`retries`** *(integer)*: Number of times to retry callback on failure. (Default 3). Default: `3`.
- **`pollInterval`** *(integer)*: Poll Interval in seconds. Default: `60`.
- **`input`**: Input for the Filters. Refer to *[#/definitions/alertFilteringInput](#definitions/alertFilteringInput)*.
- **`domain`**: Domain the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *[../type/entityReference.json](#/type/entityReference.json)*.
## Definitions

- **`argumentsInput`** *(object)*: Observability Filters for Event Subscription. Cannot contain additional properties.
  - **`name`** *(string)*: Name of the filter.
  - **`effect`**: Refer to *[./eventFilterRule.json#/definitions/effect](#eventFilterRule.json#/definitions/effect)*.
  - **`prefixCondition`**: Prefix Condition for the filter. Refer to *[../events/eventFilterRule.json#/definitions/prefixCondition](#/events/eventFilterRule.json#/definitions/prefixCondition)*.
  - **`arguments`** *(array)*: Arguments List.
    - **Items** *(object)*: Argument for the filter. Cannot contain additional properties.
      - **`name`** *(string)*: Name of the Argument.
      - **`input`** *(array)*: Value of the Argument.
        - **Items** *(string)*
- **`alertFilteringInput`** *(object)*: Observability of the event subscription. Cannot contain additional properties.
  - **`filters`** *(array)*: List of filters for the event subscription.
    - **Items**: Refer to *[#/definitions/argumentsInput](#definitions/argumentsInput)*.
  - **`actions`** *(array)*: List of filters for the event subscription.
    - **Items**: Refer to *[#/definitions/argumentsInput](#definitions/argumentsInput)*.
- **`triggerType`** *(string)*: Trigger Configuration for Alerts. Must be one of: `["RealTime", "Scheduled"]`. Default: `"RealTime"`.
- **`alertType`** *(string)*: Type of Alerts supported. Must be one of: `["Notification", "Observability", "ActivityFeed", "GovernanceWorkflowChangeEvent"]`. Default: `"Notification"`.
- **`subscriptionCategory`** *(string)*: Subscription Endpoint Type. Must be one of: `["Users", "Teams", "Admins", "Assignees", "Owners", "Mentions", "Followers", "External"]`.
- **`subscriptionType`** *(string)*: Subscription Endpoint Type. Must be one of: `["Webhook", "Slack", "MsTeams", "GChat", "Email", "ActivityFeed", "GovernanceWorkflowChangeEvent"]`.
- **`destination`** *(object)*: Subscription which has a type and the config. Cannot contain additional properties.
  - **`id`**: Unique identifier that identifies this Event Subscription. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
  - **`category`**: Refer to *[#/definitions/subscriptionCategory](#definitions/subscriptionCategory)*.
  - **`type`**: Refer to *[#/definitions/subscriptionType](#definitions/subscriptionType)*.
  - **`statusDetails`**
    - **One of**
      - : Refer to *[../events/subscriptionStatus.json](#/events/subscriptionStatus.json)*.
      - : Refer to *[../events/testDestinationStatus.json](#/events/testDestinationStatus.json)*.
  - **`timeout`** *(integer)*: Connection timeout in seconds. (Default 10s). Default: `10`.
  - **`readTimeout`** *(integer)*: Read timeout in seconds. (Default 12s). Default: `12`.
  - **`enabled`** *(boolean)*: Is the subscription enabled. Default: `true`.
  - **`config`**
    - **One of**
      - : Refer to *[../entity/events/webhook.json](#/entity/events/webhook.json)*.
      - : Refer to *[./emailAlertConfig.json](#emailAlertConfig.json)*.
- **`status`** *(string)*: Status is `disabled`, when eventSubscription was created with `enabled` set to false and it never started publishing events. Status is `active` when eventSubscription is normally functioning and 200 OK response was received for callback notification. Status is `failed` on bad callback URL, connection failures, `1xx`, and `3xx` response was received for callback notification. Status is `awaitingRetry` when previous attempt at callback timed out or received `4xx`, `5xx` response. Status is `retryLimitReached` after all retries fail. Must be one of: `["disabled", "failed", "retryLimitReached", "awaitingRetry", "active"]`.
- **`filteringRules`** *(object)*: Filtering Rules for Event Subscription. Cannot contain additional properties.
  - **`resources`** *(array, required)*: Defines a list of resources that triggers the Event Subscription, Eg All, User, Teams etc.
    - **Items** *(string)*
  - **`rules`** *(array)*: A set of filter rules associated with the Alert.
    - **Items**: Refer to *[./eventFilterRule.json](#eventFilterRule.json)*.
  - **`actions`** *(array)*: A set of filter rules associated with the Alert.
    - **Items**: Refer to *[./eventFilterRule.json](#eventFilterRule.json)*.
- **`trigger`** *(object)*: Trigger Configuration for Alerts. Cannot contain additional properties.
  - **`triggerType`**: Refer to *[#/definitions/triggerType](#definitions/triggerType)*.
  - **`scheduleInfo`** *(string)*: Schedule Info. Must be one of: `["Daily", "Weekly", "Monthly", "Custom"]`. Default: `"Weekly"`.
  - **`cronExpression`** *(string)*: Cron Expression in case of Custom scheduled Trigger.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
