---
title: eventFilterRule | OpenMetadata Event Filter Rule
description: Connect Eventfilterrule to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/events/eventfilterrule
---

# EventFilterRule

*Describes an Event Filter Rule*

## Properties

- **`name`** *(string)*: Name of this Event Filter.
- **`displayName`** *(string)*: Display Name of the Filter.
- **`fullyQualifiedName`**: FullyQualifiedName in the form `eventSubscription.eventFilterRuleName`. Refer to *[../type/basic.json#/definitions/fullyQualifiedEntityName](#/type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`description`**: Description of the Event Filter Rule. Refer to *[../type/basic.json#/definitions/markdown](#/type/basic.json#/definitions/markdown)*.
- **`effect`**: Refer to *[#/definitions/effect](#definitions/effect)*.
- **`condition`**: Expression in SpEL used for matching of a `Rule` based on entity, resource, and environmental attributes. Refer to *[../type/basic.json#/definitions/expression](#/type/basic.json#/definitions/expression)*.
- **`arguments`** *(array)*: Arguments to the Condition.
  - **Items** *(string)*
- **`inputType`** *(string)*: Must be one of: `["static", "runtime", "none"]`.
- **`prefixCondition`**: Prefix Condition to be applied to the Condition. Refer to *[#/definitions/prefixCondition](#definitions/prefixCondition)*.
## Definitions

- **`effect`** *(string)*: Must be one of: `["include", "exclude"]`. Default: `"include"`.
- **`prefixCondition`** *(string)*: Prefix Condition to be applied to the Condition. Must be one of: `["AND", "OR"]`. Default: `"AND"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
