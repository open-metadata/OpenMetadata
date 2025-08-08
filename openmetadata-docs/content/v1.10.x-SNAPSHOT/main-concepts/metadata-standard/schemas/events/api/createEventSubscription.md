---
title: createEventSubscription
slug: /main-concepts/metadata-standard/schemas/events/api/createeventsubscription
---

# CreateEventSubscription

*This defines schema for sending alerts for OpenMetadata*

## Properties

- **`name`**: Name that uniquely identifies this Alert. Refer to *../../type/basic.json#/definitions/entityName*.
- **`className`** *(string)*: Consumer Class for the Event Subscription. Will use 'AlertPublisher' if not provided.
- **`displayName`** *(string)*: Display name for this Alert.
- **`description`**: A short description of the Alert, comprehensible to regular users. Refer to *../../type/basic.json#/definitions/markdown*.
- **`owners`**: Owners of this Alert. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`enabled`** *(boolean)*: Is the alert enabled. Default: `True`.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 10). Default: `10`.
- **`alertType`**: Type of Alert. Refer to *../eventSubscription.json#/definitions/alertType*.
- **`trigger`**: Refer to *../eventSubscription.json#/definitions/trigger*.
- **`resources`** *(array)*: Defines a list of resources that triggers the Event Subscription, Eg All, User, Teams etc.
  - **Items** *(string)*
- **`destinations`** *(array)*: Subscription Config.
  - **Items**: Refer to *../../events/eventSubscription.json#/definitions/destination*.
- **`provider`**: Refer to *../../type/basic.json#/definitions/providerType*.
- **`retries`** *(integer)*: Number of times to retry callback on failure. (Default 3). Default: `3`.
- **`pollInterval`** *(integer)*: Poll Interval in seconds. Default: `10`.
- **`input`**: Input for the Filters. Refer to *../eventSubscription.json#/definitions/alertFilteringInput*.
- **`domains`** *(array)*: Fully qualified names of the domains the Event Subscription belongs to.
  - **Items** *(string)*
- **`config`**: Refer to *../../type/basic.json#/definitions/map*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
