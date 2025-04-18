---
title: Use Cases - Creating Roles & Policies in OpenMetadata
slug: /how-to-guides/admin-guide/roles-policies/use-cases
---

# Use Cases: Creating Roles & Policies in OpenMetadata

OpenMetadata comes with default configurations such as the Organization Policy and Data Consumer Roles. These roles are setup to foster data collaboration.

We advise retaining the Organization policy, which enables everyone to view the assets and claim ownership when no owner is specified.

For individual teams, tailor your policies according to the specific needs of both the organization and the team. You may choose to adopt stricter policies as detailed in the previous sections.

### Use Case 1: We want our teams to be able to create services and extract metadata

You can create a policy with DatabaseService, Ingesiton Pipeline, and Workflow resources with All operations set to allow.

{% image
src="/images/v1.7/how-to-guides/roles-policies/policy1.png"
alt="Creating Roles & Policies in OpenMetadata"
caption="Allow All Operations"
/%}

You can create a Role such as ServiceOwner role and assign the above policy. Once the role is created, you can assign it to users to enable service creation by themselves without the need for an Admin.

### Use Case 2: Roles for Data Steward

A data steward in OpenMetadata should be able to create Glossaries and Glossary Terms and be able to view all data and manage it for governance purposes.

Here is an example of a policy to enable it for Data Stewards using two rules.
1. **Allow Glossary Operations:** Enables the policy to allow operations on all Glossary related actions.
2. **Edit Rule:** Grants access to the Data Steward to edit description, edit tags on all entities; enabling the user to manage the data.

You can fine tune these permissions to suit your organizational needs.

{% image
src="/images/v1.7/how-to-guides/roles-policies/policy2.png"
alt="Roles for Data Steward"
caption="Roles for Data Steward"
/%}

### Use Case 3: Only the team that owns the data asset should be able to access it

To safeguard the data owned by a specific team, you can prevent external access.

The above rule specifies to deny all operations if the logged-in user is not the owner, or if the logged-in user’s team is not the owner of an asset.

{% image
src="/images/v1.7/how-to-guides/roles-policies/policy3.png"
alt="Team Only Policy"
caption="Team Only Policy"
/%}

### Use Case 4: Deny all the access if the data asset is tagged with PII.Sensitive and allow only the owners

Just like the above policy, you can create a rule with complex conditions as shown below

{% image
src="/images/v1.7/how-to-guides/roles-policies/policy4.png"
alt="PII Sensitive Tag Policy"
caption="PII Sensitive Tag Policy"
/%}

In this rule, we are specifying to deny operations if the table tag contains PII.Sensitive tag and if the logged-in user is not the owner, or their team is not the owner of the Table.
