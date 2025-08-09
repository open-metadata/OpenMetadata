---
title: rule
slug: /main-concepts/metadata-standard/schemas/entity/policies/accesscontrol/rule
---

# Rule

*Describes an Access Control Rule for OpenMetadata Metadata Operations. All non-null user (subject) and entity (object) attributes are evaluated with logical AND.*

## Properties

- **`name`** *(string)*: Name of this Rule.
- **`fullyQualifiedName`**: FullyQualifiedName in the form `policyName.ruleName`. Refer to *../../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`**: Description of the rule. Refer to *../../../type/basic.json#/definitions/markdown*.
- **`effect`** *(string)*: Must be one of: `['allow', 'deny']`.
- **`operations`** *(array)*: List of operation names related to the `resources`. Use `*` to include all the operations. Default: `None`.
  - **Items**: Refer to *resourceDescriptor.json#/definitions/operation*.
- **`resources`** *(array)*: Resources/objects related to this rule. Resources are typically `entityTypes` such as `table`, `database`, etc. It also includes `non-entityType` resources such as `lineage`. Use `*` to include all the resources. Default: `None`.
  - **Items** *(string)*
- **`condition`**: Expression in SpEL used for matching of a `Rule` based on entity, resource, and environmental attributes. Refer to *../../../type/basic.json#/definitions/expression*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
