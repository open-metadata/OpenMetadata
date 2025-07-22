---
title: Advanced Guide for Roles and Policies
description: Manage roles and policies to control permissions, ownership, and governance enforcement.
slug: /how-to-guides/admin-guide/roles-policies
---

# Advanced Guide for Roles and Policies

## Users and Teams

OpenMetadata introduces a versatile hierarchical team structure that aligns with your organization's setup. Administrators can mirror their organizational hierarchy by creating various team types.

**Organization** serves as the foundation of the team hierarchy representing the entire company. Under Organization, you can add Business Units, Divisions, Departments, Groups, and Users. For instance, if your company is Facebook, then the Organization represents entire Facebook itself, which further houses diverse teams like Engineering, Sales, Finance, and Marketing.

{% image
src="/images/v1.7/how-to-guides/roles-policies/all-teams.png"
alt="Teams Hierarchy"
caption="Teams Hierarchy"
/%}

**BusinessUnit** is positioned one level below the Organization and can contain other Business Units, Divisions, Departments, and Groups. To illustrate, the Engineering Business Unit could be one of the top-tier Business Units in the Organization. It contains other teams like Groups and additional Business Units.

{% image
src="/images/v1.7/how-to-guides/roles-policies/b-u.png"
alt="Business Unit"
caption="Business Unit"
/%}

**Division** is positioned below Business Unit and can include Divisions, Departments, and Groups. For example, a Division named 'Product Development' under the Engineering Business Unit. It can have teams like 'Software Division,' 'Hardware Division,' and 'QA Division.'

**Department** is positioned below Division and can include other Departments and Groups. For example, a 'Data Engineering Department could include specialized teams like 'Infrastructure,' 'Data Science,' and 'Platform.'

**Group** represents the final tier in this hierarchy. It contains a group of users that reflect finite teams within your organization.

***Notably, only Groups have the privilege of owning Data Assets within the OpenMetadata platform.***

This structured hierarchy enhances your control over team management and resource ownership. By creating a dynamic model mirroring your organization's functions, OpenMetadata empowers you to effortlessly manage permissions, access controls, and data ownership at different levels of granularity.

## Access Control Design: Roles and Policies

{% image
src="/images/v1.7/how-to-guides/roles-policies/evaluation.png"
alt="Policy Evaluation"
caption="Policy Evaluation"
/%}

OpenMetadata incorporates a robust Access Control framework that merges Role-Based Access Control (RBAC) with Attribute-Based Access Control (ABAC) in a powerful hybrid model. This security design is reinforced by

**Authentication with SSO Integration:** OpenMetadata seamlessly integrates with various Single Sign-On (SSO) providers, including Azure AD, Google, Okta, Auth0, OneLogin, and more. This ensures a unified and secure authentication experience for users.

**Team Hierarchy:** OpenMetadata offers a structured team hierarchy that mirrors your organization's structure, enhancing manageability and granularity in access control.

**Roles and Policies:** Policies and Roles are pivotal in determining who can access what resources and perform what actions. These policies are based on a combination of user attributes, roles, and resource attributes.

**User and Bots Authentication:** OpenMetadata accommodates human users and automated applications (bots). For human users, logging into the OpenMetadata UI mandates SSO authentication. Upon successful authentication, a JWT token is issued. 
Bots, on the other hand, are equipped with a JWT token generated based on SSL certificates. This token serves as their identity and authorization mechanism when interacting with the OpenMetadata server APIs.

## Authentication Flow

{% image
src="/images/v1.7/how-to-guides/roles-policies/auth.png"
alt="Authentication Flow"
caption="Authentication Flow"
/%}

**User Authentication:** When users access the OpenMetadata UI, they authenticate with their SSO provider. Upon successful authentication, a JWT token is generated. This token validates the user's session and permits them to authenticate requests to the OpenMetadata server.

**Bot Authentication:** Automated applications like the ingestion connector are equipped with a pre-generated JWT Token. OpenMetadata, with its configured SSL Certificates, authenticates the JWT token, establishing the bot's identity. This token authorizes the bot to interact with OpenMetadata server APIs.

## Authorization Framework

OpenMetadata's authorization is a result of evaluating three crucial factors:

{% image
src="/images/v1.7/how-to-guides/roles-policies/access.png"
alt="Authorization Framework"
caption="Authorization Framework"
/%}

**Who is the User (Authentication):** This aspect is determined by the authentication process – whether it a user or a bot – ensuring that only authorized entities access the system.

**What Resource (Resource Attributes):** Based on the API calls being made, OpenMetadata identifies the target resource and its associated attributes.

Below is a list of resources that correspond to Entities such as Table, Topic, Pipeline, etc.

{% image
src="/images/v1.7/how-to-guides/roles-policies/rules1.png"
alt="Resources Correspond to Entities"
caption="Resources Correspond to Entities"
/%}

**What Operation (API Call):** Each API call is linked to a specific operation, such as editing descriptions, deleting tags, changing ownership, etc.

There are common operations such as Create, Delete, and ViewAll that apply to all the resources. Each resource can also have its specific operation, such as ViewTests, ViewQueries for Table.

## Difference Between ViewBasic and ViewAll in OpenMetadata

The operations **ViewBasic** and **ViewAll** in OpenMetadata differ in the level of detail they provide access to. Below is a detailed explanation of each operation:

### ViewBasic
- Provides access to the **basic details** of an asset.
- Includes information such as:
  - Description
  - Tags
  - Owner
  - Fundamental metadata
- **Excludes** more detailed information, including:
  - Profile data
  - Sample data
  - Data profile
  - Tests
  - Queries

### Key Points:
- Suitable for viewing foundational asset metadata.
- Limited access for users who do not require in-depth technical details.

### ViewAll
- Provides access to **all details** of an asset.
- Includes everything available in **ViewBasic**, along with:
  - Profile data
  - Sample data
  - Data profile
  - Tests
  - Queries

### Key Points:
- Designed for users who need a complete view of the asset.
- Offers comprehensive insights and detailed metadata.

## Summary Table

| Feature            | **ViewBasic**                          | **ViewAll**                          |
|--------------------|----------------------------------------|--------------------------------------|
| Basic Details      | ✅ Included                           | ✅ Included                          |
| Profile Data       | ❌ Not Included                        | ✅ Included                          |
| Sample Data        | ❌ Not Included                        | ✅ Included                          |
| Data Profile       | ❌ Not Included                        | ✅ Included                          |
| Tests & Queries    | ❌ Not Included                        | ✅ Included                          |

### Overview:
- **ViewBasic**: Focused on essential metadata.
- **ViewAll**: Provides a complete view, including advanced details.

Choose the appropriate operation based on the level of access required.

{% image
src="/images/v1.7/how-to-guides/roles-policies/rules2.png"
alt="Each Resource has its Own Set of Granular Operations"
caption="Each Resource has its Own Set of Granular Operations"
/%}

By synthesizing these components, OpenMetadata dynamically ascertains whether a user or bot can perform a particular action on a specific resource. This **fusion of RBAC and ABAC** in the hybrid model contributes to a robust and flexible access control mechanism, bolstering the security and control of your OpenMetadata environment.

{%inlineCallout
  color="violet-70"
  bold="Building Blocks of Authorization: Rules, Policies, and Roles"
  icon="MdArrowForward"
  href="/how-to-guides/admin-guide/roles-policies/authorization"%}
  Learn all the details of Rules, Policies, and Roles
{%/inlineCallout%}

{%inlineCallout
  color="violet-70"
  bold="Use Cases: Creating Roles & Policies in OpenMetadata"
  icon="MdArrowForward"
  href="/how-to-guides/admin-guide/roles-policies/use-cases"%}
  Tailor you policies to meet your organizational and team needs.
{%/inlineCallout%}
