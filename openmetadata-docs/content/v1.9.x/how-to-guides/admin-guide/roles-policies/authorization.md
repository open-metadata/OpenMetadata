---
title: Building Blocks of Authorization - Rules, Policies, and Roles
description: Understand authorization policies to manage read, write, and discover permissions for users and service accounts.
slug: /how-to-guides/admin-guide/roles-policies/authorization
---

# Building Blocks of Authorization: Rules, Policies, and Roles

## Building Blocks of Authorization: Rules

A Rule in a Policy is the building block of Authorization. It contains the following:
1. **Name:** A unique name to define the rule
2. **Description:** Description of the rule
3. **Resources:** List of resources this rule applies to. An Admin can select a specific resource, such as Table or All, to apply against all resources.
4. **Operations:** List of operations this rule applies to. An Admin can select a specific operation such as EditOwner or All to apply against all the operations.
5. **Condition:** Expressions written using policy functions that evaluate true or false.
6. **Effect:** Deny or Allow the operation.

{% image
src="/images/v1.9/how-to-guides/roles-policies/rules3.png"
alt="Building Blocks of Authorization: Rules"
caption="Building Blocks of Authorization: Rules"
/%}

## Condition

OpenMetadata provides [SpEL](https://docs.spring.io/spring-framework/docs/3.0.x/reference/expressions.html)-based conditions for Admins to select during rule creation.

Here are some examples of conditions.

|  |  |
|--- | --- |
| **noOwner()** | Returns true if the resource being accessed has no owner. |
| **isOwner()** | Returns true if the user accessing the resource is the owner of the resource. |
| **matchAllTags(tagFqn, [tagFqn…])** | Returns true if the resource has all the tags from the tag list. |
| **matchAnyTag(tagFqn, [tagFqn…])** | Returns true if the resource has any of the tags from the tag list. |
| **matchTeam()** | Returns true if the user belongs to the team that owns the resource. |
| **hasDomain()** | Returns true if the logged in user is the has domain access of the entity being accessed |

Conditions are used to assess DataAsset like Tables/Topics/Dashboards etc.. for specific attributes.

Example: Consider the noOwner() condition when applied to the table **fact_orders**. If this table lacks an assigned owner, then the condition returns **true**. However, if an owner is present, it returns **false**.

Another instance: The ***matchAnyTag(PII.Sensitive)*** condition, when applied to the **dim_address** table that carries the PII.Sensitive tag, will yield **true**. But, without this specific tag, the outcome is **false**.

You can also combine conditions using logical operators like AND (&&) or OR (||).

For instance, the combined condition:
***noOwner() && matchAllTags('PersonalData.Personal', 'Tier.Tier1', 'Business Glossary.Clothing')***
will produce a true result if the Data Asset (be it a Table, Topic, etc.) has no assigned owner and concurrently matches all specified tags.

These dynamic conditions empower admins to craft rules that holistically consider the DataAssets and its attributes when dictating access control.

### Default Policy and Rule

When navigating to Settings -> Policies -> Organization Policy, you'll discover the default rules set at the organizational level. Here’s a quick breakdown of these rules:

{% image
src="/images/v1.9/how-to-guides/roles-policies/rules4.png"
alt="Default Policy and Rule"
caption="Default Policy and Rule"
/%}

#### OrganizationPolicy-NoOwner-Rule

{% image
src="/images/v1.9/how-to-guides/roles-policies/rules5.png"
alt="Organization Policy - No Owner - Rule"
caption="Organization Policy - No Owner - Rule"
/%}

**Purpose:** This rule allows users to assign ownership to resources without an owner.

**Example:** If a user accesses fact_table and finds that it is unowned, then they can modify the ownership field to establish a new owner. However, for a table like dim_address that already has an assigned owner, any attempt to change the ownership will be restricted.

#### OrganizationPolicy-Owner-Rule

{% image
src="/images/v1.9/how-to-guides/roles-policies/rules6.png"
alt="Organization Policy - Owner - Rule"
caption="Organization Policy - Owner - Rule"
/%}

**Purpose:** This rule grants permissions based on the ownership of a data asset.

**Details:** When a user, who either personally owns a table or is part of the team owning that table logs in, they're granted extensive rights. They can modify all properties of that Data Asset and access complete information about it.

By setting up such default rules, the organization ensures clarity in access control based on ownership status and user roles.

## Building Blocks of Authorization: Policies

A policy encompasses multiple rules, as delineated earlier. When a user accesses a resource, the policy evaluates all its associated rules in the context of that user's current session.

**Resolving Conflicts**
In instances where a policy has contradicting rules - for example, one rule allows "EditDescription" for all resources while another denies the same - the "Deny" action takes precedence.

**Policy Assignments**
While policies can be associated with a specific team within the organizational hierarchy, they cannot be directly linked to individual users.

**Inheritance and Application**

{% image
src="/images/v1.9/how-to-guides/roles-policies/inheritance.png"
alt="Inheritance and Application"
caption="Inheritance and Application"
/%}

Any user positioned within a team structure inherently adopts its policies. For instance, if the **"Organization-NoOwner-Policy"** is instituted at the organization's apex, all its internal members will be governed by this policy and the rules therein.

Similarly, if a policy is designated to "Division1" such as “Division Policy”, every member, be it "Department", "Team1", "Team2", or the individual users in these groups, will fall under its purview.

However, if you formulate a policy explicitly for "Team1", only the members of "Team1" will be affected.

**The Philosophy Behind the Design**

This architecture aims to establish broad, overarching rules at the organizational level, potentially being more lenient in nature. As you move down the hierarchy, teams can sculpt stricter, more tailored policies. For instance, a policy might dictate, "Deny access to everyone outside of Team 1." This ensures a blend of flexibility at the top and precision at the grassroots level.

## Building Blocks of Authorization: Roles

Policies serve as mechanisms to enforce authorization, while Roles offer a more structured hierarchy for the same purpose. Each role is closely aligned with a user's function or job description.

{% image
src="/images/v1.9/how-to-guides/roles-policies/role1.png"
alt="Building Blocks of Authorization: Roles"
caption="Building Blocks of Authorization: Roles"
/%}

For instance, in an organization, you might have:
- **Data Engineers:** Tasked with producing data assets.
- **Data Scientists:** Responsible for creating dashboards and utilizing assets developed by Data Engineers.
- **Data Stewards:** Experts in all data-related matters who oversee governance duties within the organization.

Roles provide the advantage of bundling multiple policies encapsulating a user’s specific function or job. For example, a "Data Consumer" role would encompass a "Data Consumer Policy." Any individual or team assigned this role would automatically be subject to the stipulations outlined in the associated policies.

Moreover, roles can be allocated either to individual users or teams within an organizational hierarchy. When a role is assigned to a team, every member of that team inherits the privileges of that role. This design is intentional, aiming to simplify the role assignment process for administrators.

## Roles Based Access Controls (RBAC) Search

In OpenMetadata, Role-Based Access Control (RBAC) extends to search functionalities, allowing administrators to enforce granular permissions on metadata assets. By default, the search feature permits all users to access and view available data assets. To restrict search results based on user roles and policies, administrators must enable the Search RBAC setting.​

To enable or disable the **RBAC Search** option, navigate to **Settings > Preferences > Search** in the OpenMetadata UI. This setting controls whether search results are filtered based on the user's assigned roles and permissions.

{% image
src="/images/v1.9/how-to-guides/roles-policies/rbac-search.png"
alt="Roles Based Access Controls (RBAC) Search Option"
caption="Roles Based Access Controls (RBAC) Search Option"
/%}

### Implications of Enabling Search RBAC:

**Restricted Search Results**: Users will only see search results for data assets they have explicit permissions to access, enhancing data security and compliance.​

**Policy Enforcement**: The system will enforce policies at the search level, ensuring that unauthorized users cannot discover or access sensitive metadata.​

### Additional Considerations:

**Role and Policy Configuration**: Ensure that roles and policies are appropriately configured to reflect the desired access controls. This includes assigning correct permissions to users and teams for various data assets.​

**Testing**: After enabling Search RBAC, conduct thorough testing to verify that users can access only the data assets permitted by their roles and policies.​

For a comprehensive understanding of configuring roles and policies, refer to the [Advanced Guide for Roles and Policies](/how-to-guides/admin-guide/roles-policies). Implementing Search RBAC ensures that OpenMetadata's search functionality aligns with your organization's data governance and security requirements.​

{%inlineCallout
  color="violet-70"
  bold="Use Cases: Creating Roles & Policies in OpenMetadata"
  icon="MdArrowForward"
  align="right"
  href="/how-to-guides/admin-guide/roles-policies/use-cases"%}
  Tailor you policies to meet your organizational and team needs.
{%/inlineCallout%}