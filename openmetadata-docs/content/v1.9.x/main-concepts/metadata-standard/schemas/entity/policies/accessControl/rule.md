---
title: Rule Schema | OpenMetadata Rules Schema and API
description: Define access control rule schema including effect, conditions, resources, and action types.
slug: /main-concepts/metadata-standard/schemas/entity/policies/accesscontrol/rule
---

# Rule

*Describes an Access Control Rule for OpenMetadata Metadata Operations. All non-null user (subject) and entity (object) attributes are evaluated with logical AND.*

## Properties

- **`name`** *(string)*: Name of this Rule.
- **`fullyQualifiedName`**: FullyQualifiedName in the form `policyName.ruleName`. Refer to *[../../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`description`**: Description of the rule. Refer to *[../../../type/basic.json#/definitions/markdown](#/../../type/basic.json#/definitions/markdown)*.
- **`effect`** *(string)*: Must be one of: `["allow", "deny"]`.
- **`operations`** *(array)*: List of operation names related to the `resources`. Use `*` to include all the operations. Default: `null`.
  - **Items**: Refer to *[resourceDescriptor.json#/definitions/operation](#sourceDescriptor.json#/definitions/operation)*.
- **`resources`** *(array)*: Resources/objects related to this rule. Resources are typically `entityTypes` such as `table`, `database`, etc. It also includes `non-entityType` resources such as `lineage`. Use `*` to include all the resources. Default: `null`.
  - **Items** *(string)*
- **`condition`**: Expression in SpEL used for matching of a `Rule` based on entity, resource, and environmental attributes. Refer to *[../../../type/basic.json#/definitions/expression](#/../../type/basic.json#/definitions/expression)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
