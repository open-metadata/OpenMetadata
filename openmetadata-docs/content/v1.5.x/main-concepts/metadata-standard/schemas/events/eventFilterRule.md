---
title: eventFilterRule
slug: /main-concepts/metadata-standard/schemas/events/eventfilterrule
---

# EventFilterRule

*Describes an Event Filter Rule*

## Properties

- **`name`** *(string)*: Name of this Event Filter.
- **`fullyQualifiedName`**: FullyQualifiedName in the form `eventSubscription.eventFilterRuleName`. Refer to *../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`**: Description of the Event Filter Rule. Refer to *../type/basic.json#/definitions/markdown*.
- **`effect`** *(string)*: Must be one of: `['include', 'exclude']`.
- **`condition`**: Expression in SpEL used for matching of a `Rule` based on entity, resource, and environmental attributes. Refer to *../type/basic.json#/definitions/expression*.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
