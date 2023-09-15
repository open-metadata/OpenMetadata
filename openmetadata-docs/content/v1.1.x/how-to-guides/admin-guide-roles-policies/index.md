---
title: Admin Guide for Roles and Policies
slug: /how-to-guides/admin-guide-roles-policies
---

# Admin Guide for Roles and Policies

## Users and Teams

OpenMetadata introduces a versatile hierarchical team structure that aligns with your organization's setup. Administrators can mirror their organizational hierarchy by creating various team types.

**Organization** serves as the foundation of the team hierarchy representing the entire company. Under Organization, you can add Business Units, Divisions, Departments, Groups, and Users. For instance, if your company is Facebook, then the Organization represents entire Facebook itself, which further houses diverse teams like Engineering, Sales, Finance, and Marketing.

{% image
src="/images/v1.1/how-to-guides/roles-policies/all-teams.png"
alt="Teams Hierarchy"
caption="Teams Hierarchy"
/%}

**BusinessUnit** is positioned one level below the Organization and can contain other Business Units, Divisions, Departments, and Groups. To illustrate, the Engineering Business Unit could be one of the top-tier Business Units in the Organization. It contains other teams like Groups and additional Business Units.

{% image
src="/images/v1.1/how-to-guides/roles-policies/b-u.png"
alt="Business Unit"
caption="Business Unit"
/%}

**Division** is positioned below Business Unit and can include Divisions, Departments, and Groups. For example, a Division named 'Product Development' under the Engineering Business Unit. It can have teams like 'Software Division,' 'Hardware Division,' and 'QA Division.'

**Department** is positioned below Division and can include other Departments and Groups. For example, a 'Data Engineering Department could include specialized teams like 'Infrastructure,' 'Data Science,' and 'Platform.'

**Group** represents the final tier in this hierarchy. It contains a group of users that reflect finite teams within your organization.

***Notably, only Groups have the privilege of owning Data Assets within the OpenMetadata platform.***

This structured hierarchy enhances your control over team management and resource ownership. By creating a dynamic model mirroring your organization's functions, OpenMetadata empowers you to effortlessly manage permissions, access controls, and data ownership at different levels of granularity.

## Access Control Design: Roles and Policies

OpenMetadata incorporates a robust Access Control framework that merges Role-Based Access Control (RBAC) with Attribute-Based Access Control (ABAC) in a powerful hybrid model. This security design is reinforced by

**Authentication with SSO Integration:** OpenMetadata seamlessly integrates with various Single Sign-On (SSO) providers, including Azure AD, Google, Okta, Auth0, OneLogin, and more. This ensures a unified and secure authentication experience for users.

**Team Hierarchy:** OpenMetadata offers a structured team hierarchy that mirrors your organization's structure, enhancing manageability and granularity in access control.

**Roles and Policies:** Policies and Roles are pivotal in determining who can access what resources and perform what actions. These policies are based on a combination of user attributes, roles, and resource attributes.

**User and Bots Authentication:** OpenMetadata accommodates human users and automated applications (bots). For human users, logging into the OpenMetadata UI mandates SSO authentication. Upon successful authentication, a JWT token is issued. 
Bots, on the other hand, are equipped with a JWT token generated based on SSL certificates. This token serves as their identity and authorization mechanism when interacting with the OpenMetadata server APIs.

## Authentication Flow

{% image
src="/images/v1.1/how-to-guides/roles-policies/auth.png"
alt="Authentication Flow"
caption="Authentication Flow"
/%}

**User Authentication:** When users access the OpenMetadata UI, they authenticate with their SSO provider. Upon successful authentication, a JWT token is generated. This token validates the user's session and permits them to authenticate requests to the OpenMetadata server.

**Bot Authentication:** Automated applications like the ingestion connector are equipped with a pre-generated JWT Token. OpenMetadata, with its configured SSL Certificates, authenticates the JWT token, establishing the bot's identity. This token authorizes the bot to interact with OpenMetadata server APIs.

## Authorization Framework

OpenMetadata's authorization is a result of evaluating three crucial factors:

{% image
src="/images/v1.1/how-to-guides/roles-policies/access.png"
alt="Authorization Framework"
caption="Authorization Framework"
/%}

**Who is the User (Authentication):** This aspect is determined by the authentication process – whether it a user or a bot – ensuring that only authorized entities access the system.

**What Resource (Resource Attributes):** Based on the API calls being made, OpenMetadata identifies the target resource and its associated attributes.

Below is a list of resources that correspond to Entities such as Table, Topic, Pipeline, etc.

{% image
src="/images/v1.1/how-to-guides/roles-policies/rules1.png"
alt="Resources Correspond to Entities"
caption="Resources Correspond to Entities"
/%}

**What Operation (API Call):** Each API call is linked to a specific operation, such as editing descriptions, deleting tags, changing ownership, etc.

There are common operations such as Create, Delete, and ViewAll that apply to all the resources. Each resource can also have its specific operation, such as ViewTests, ViewQueries for Table.

{% image
src="/images/v1.1/how-to-guides/roles-policies/rules2.png"
alt="Each Resource has its Own Set of Granular Operations"
caption="Each Resource has its Own Set of Granular Operations"
/%}

By synthesizing these components, OpenMetadata dynamically ascertains whether a user or bot can perform a particular action on a specific resource. This **fusion of RBAC and ABAC** in the hybrid model contributes to a robust and flexible access control mechanism, bolstering the security and control of your OpenMetadata environment.

## Building Blocks of Authorization: Rules

A Rule in a Policy is the building block of Authorization. It contains the following:
1. **Name:** A unique name to define the rule
2. **Description:** Description of the rule
3. **Resources:** List of resources this rule applies to. An Admin can select a specific resource, such as Table or All, to apply against all resources.
4. **Operations:** List of operations this rule applies to. An Admin can select a specific operation such as EditOwner or All to apply against all the operations.
5. **Condition:** Expressions written using policy functions that evaluate true or false.
6. **Effect:** Deny or Allow the operation.

{% image
src="/images/v1.1/how-to-guides/roles-policies/rules3.png"
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
src="/images/v1.1/how-to-guides/roles-policies/rules4.png"
alt="Default Policy and Rule"
caption="Default Policy and Rule"
/%}

#### OrganizationPolicy-NoOwner-Rule

{% image
src="/images/v1.1/how-to-guides/roles-policies/rules5.png"
alt="Organization Policy - No Owner - Rule"
caption="Organization Policy - No Owner - Rule"
/%}

**Purpose:** This rule allows users to assign ownership to resources without an owner.

**Example:** If a user accesses fact_table and finds that it is unowned, then they can modify the ownership field to establish a new owner. However, for a table like dim_address that already has an assigned owner, any attempt to change the ownership will be restricted.

#### OrganizationPolicy-Owner-Rule

{% image
src="/images/v1.1/how-to-guides/roles-policies/rules6.png"
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
src="/images/v1.1/how-to-guides/roles-policies/inheritance.png"
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
src="/images/v1.1/how-to-guides/roles-policies/role1.png"
alt="Building Blocks of Authorization: Roles"
caption="Building Blocks of Authorization: Roles"
/%}

For instance, in an organization, you might have:
- **Data Engineers:** Tasked with producing data assets.
- **Data Scientists:** Responsible for creating dashboards and utilizing assets developed by Data Engineers.
- **Data Stewards:** Experts in all data-related matters who oversee governance duties within the organization.

Roles provide the advantage of bundling multiple policies encapsulating a user’s specific function or job. For example, a "Data Consumer" role would encompass a "Data Consumer Policy." Any individual or team assigned this role would automatically be subject to the stipulations outlined in the associated policies.

Moreover, roles can be allocated either to individual users or teams within an organizational hierarchy. When a role is assigned to a team, every member of that team inherits the privileges of that role. This design is intentional, aiming to simplify the role assignment process for administrators.

## Use Cases: Creating Roles & Policies in OpenMetadata

OpenMetadata comes with default configurations such as the Organization Policy and Data Consumer Roles. These roles are setup to foster data collaboration.

We advise retaining the Organization policy, which enables everyone to view the assets and claim ownership when no owner is specified.

For individual teams, tailor your policies according to the specific needs of both the organization and the team. You may choose to adopt stricter policies as detailed in the previous sections.

### Use Case 1: We want our teams to be able to create services and extract metadata

You can create a policy with DatabaseService, Ingesiton Pipeline, and Workflow resources with All operations set to allow.

{% image
src="/images/v1.1/how-to-guides/roles-policies/policy1.png"
alt="Creating Roles & Policies in OpenMetadata"
/%}

You can create a Role such as ServiceOwner role and assign the above policy. Once the role is created, you can assign it to users to enable service creation by themselves without the need for an Admin.

### Use Case 2: Roles for Data Steward

A data steward in OpenMetadata should be able to create Glossaries and Glossary Terms and be able to view all data and manage it for governance purposes.

Here is an example of a policy to enable it for Data Stewards using two rules.
1. **Allow Glossary Operations:** Enables the policy to allow operations on all Glossary related actions.
2. **Edit Rule:** Grants access to the Data Steward to edit description, edit tags on all entities; enabling the user to manage the data.

You can fine tune these permissions to suit your organizational needs.

{% image
src="/images/v1.1/how-to-guides/roles-policies/policy2.png"
alt="Roles for Data Steward"
caption="Roles for Data Steward"
/%}

### Use Case 3: Only the team that owns the data asset should be able to access it

To safeguard the data owned by a specific team, you can prevent external access.

The above rule specifies to deny all operations if the logged-in user is not the owner, or if the logged-in user’s team is not the owner of an asset.

{% image
src="/images/v1.1/how-to-guides/roles-policies/policy3.png"
alt="Team Only Policy"
caption="Team Only Policy"
/%}

### Use Case 4: Deny all the access if the data asset is tagged with PII.Sensitive and allow only the owners

Just like the above policy, you can create a rule with complex conditions as shown below

{% image
src="/images/v1.1/how-to-guides/roles-policies/policy4.png"
alt="PII Sensitive Tag Policy"
caption="PII Sensitive Tag Policy"
/%}

In this rule, we are specifying to deny operations if the table tag contains PII.Sensitive tag and if the logged-in user is not the owner, or their team is not the owner of the Table.