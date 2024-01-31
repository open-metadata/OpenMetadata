---
title: createEventSubscription
slug: /main-concepts/metadata-standard/schemas/events/api/createeventsubscription
---

# CreateEventSubscription

*This defines schema for sending alerts for OpenMetadata*

## Properties

- **`name`**: Name that uniquely identifies this Alert. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display name for this Alert.
- **`description`**: A short description of the Alert, comprehensible to regular users. Refer to *../../type/basic.json#/definitions/markdown*.
- **`owner`**: Owner of this Alert. Refer to *../../type/entityReference.json*. Default: `None`.
- **`enabled`** *(boolean)*: Is the alert enabled. Default: `True`.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 10). Default: `10`.
- **`timeout`** *(integer)*: Connection timeout in seconds. (Default 10s). Default: `10`.
- **`readTimeout`** *(integer)*: Read timeout in seconds. (Default 12s). Default: `12`.
- **`alertType`**: Type of Alert. Refer to *../eventSubscription.json#/definitions/alertType*.
- **`trigger`**: Refer to *../eventSubscription.json#/definitions/trigger*.
- **`filteringRules`**: Set of rules that the Alert Contains to allow conditional control for alerting. Refer to *../eventSubscription.json#/definitions/filteringRules*.
- **`subscriptionType`**: Refer to *../eventSubscription.json#/definitions/subscriptionType*.
- **`subscriptionConfig`**: Refer to *../eventSubscription.json#/definitions/subscriptionConfig*.
- **`provider`**: Refer to *../../type/basic.json#/definitions/providerType*.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
