---
title: rule
slug: /main-concepts/metadata-standard/schemas/entity/policies/accesscontrol/rule
---

# AccessControlRule

*Describes an Access Control Rule for OpenMetadata Metadata Operations. All non-null user (subject) and entity (object) attributes are evaluated with logical AND.*

## Properties

- **name (string)**: Name of this Rule
- **fullyQualifiedName (fullyQualifiedEntityName)**: FullyQualifiedName in the form policyName.ruleName.
- **description (markdown)**: Description of the rule.
- **effect (string)**: Indicates whether the rule allows or denies access.", where effect can take on one of two values: "allow" or "deny".
- **operations (array of operation objects)**: List of operation names related to the resources. Use * to include all the operations.
- **resources (array of strings)**: Resources/objects related to this rule. Resources are typically entityTypes such as table, database, etc. It also includes non-entityType resources such as lineage. Use * to include all the resources.
- **condition (expression)**: Expression in SpEL used for matching of a Rule based on entity, resource, and environmental attributes.
## Definitions

- **`operation`** *(string)*: This schema defines all possible operations on metadata of data entities. Must be one of: `['Create', 'Delete', 'ViewAll', 'ViewUsage', 'ViewTests', 'TableViewQueries', 'TableViewDataProfile', 'TableViewSampleData', 'EditAll', 'EditDescription', 'EditTags', 'EditOwner', 'EditTier', 'EditCustomFields', 'EditLineage', 'EditReviewers', 'EditTests', 'TableEditQueries', 'TableEditDataProfile', 'TableEditSampleData', 'TeamEditUsers']`.

## Condition

**hasAnyRole:** Returns true if the user (either direct or inherited from the parent teams) has one or more roles from the list.

**Example:**

```
hasAnyRole('DataSteward', 'DataEngineer')

```
**inAnyTeam:** Returns true if the user belongs under the hierarchy of any of the teams in the given team list.

**Example:**

```
inAnyTeam('marketing')

```
**isOwner:** Returns true if the user belongs under the hierarchy of any of the teams in the given team list.

**Example:**

```
isOwner()
!isOwner
noOwner() || isOwner()

```
**matchAllTags:** Returns true if the entity being accessed has all the tags given as input.

**Example:**

```
matchAllTags('PersonalData.Personal', 'Tier.Tier1', 'Business Glossary.Clothing')

```
**matchAnyTag:** Returns true if the entity being accessed has at least one of the tags given as input.

**Example:**

```
matchAnyTag('PersonalData.Personal', 'Tier.Tier1', 'Business Glossary.Clothing')

```
**matchTeam:** Returns true if the user and the resource belongs to the team hierarchy where this policy is attached. This allows restricting permissions to a resource to the members of the team hierarchy.

**Example:**

```
matchTeam()

```
**noOwner**: Returns true if the entity being accessed has no owner.

**Example:**

```
noOwner()
!noOwner
noOwner() || isOwner()

```


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
