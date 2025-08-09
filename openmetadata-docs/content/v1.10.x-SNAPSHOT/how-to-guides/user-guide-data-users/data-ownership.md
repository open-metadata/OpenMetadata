---
title: How to Assign or Change Data Ownership
description: Learn how to establish and manage data ownership in OpenMetadata. Complete guide for data users on assigning owners, tracking responsibility, and governance.
slug: /how-to-guides/guide-for-data-users/data-ownership
---

# How to Assign or Change Data Ownership

## Data Asset Ownership

In OpenMetadata, either a **team** or **multiple user** can be the owner of a data asset. Owners have access to perform all the operations on a data asset. For example, edit description, tags, glossary terms, etc.

## Assign Data Ownership

Admin users have access to add or change data ownership.

- Navigate to the data asset and click on the edit icon next to the Owner of the data asset.
- Select a Team or a User as the Owner of the Data Asset.

{% image
src="/images/v1.9/how-to-guides/user-guide-for-data-stewards/data-owner1.png"
alt="Assign an Owner to a Data Asset"
caption="Assign an Owner to a Data Asset"
/%}

## Change Data Ownership

If the data asset already has an owner, you can change the owner by clicking on the edit icon for Owner and simply selecting a team or user to change ownership.

{% image
src="/images/v1.9/how-to-guides/user-guide-for-data-stewards/data-owner2.png"
alt="Change the Owner of the Data Asset"
caption="Change the Owner of the Data Asset"
/%}

If no owner is selected, and if the Database or Database Schema has a owner, then by default the same owner will be assigned to the Database Schema or Table respectively, based on the owner propagation in OpenMetadata.

## Owner Propagation in OpenMetadata

OpenMetadata supports Owner Propagation and the owner will be propagated based on a top-down hierarchy. The owner of the Database will be auto-propagated as the owner of the Database Schemas and Tables under it. Similarly, the owner of the Database Schema will be auto-propagated as the owner of the Tables under it.

- Owner Propagation does not work for data assets that already have an Owner assigned to them. If there is **no owner**, then an Owner will be assigned based on the hierarchy.

- If a Database or Database Schema has an Owner assigned, and you **delete the owner** from the Database Schema or Tables under it, then the Owner will be auto-assigned in this case based on the existing Owner details at the top hierarchy.

- You can also assign a different owner manually.

## Team Ownership is Preferred

OpenMetadata is a data collaboration platform. We highly recommend Team Ownership of data assets, because individual users will only have part of the context about the data asset in question. Assigning team ownership will give access to all the members of a particular team. Only teams of the type ‘**Groups**’ can own data assets.

{%inlineCallout
  color="violet-70"
  bold="How to Follow a Data Asset"
  icon="MdArrowForward"
  href="/how-to-guides/guide-for-data-users/follow-data-asset"%}
  Learn how to follow data assets
{%/inlineCallout%}