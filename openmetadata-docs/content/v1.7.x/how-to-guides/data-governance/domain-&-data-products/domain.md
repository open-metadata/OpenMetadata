---
title:  How to Use Domains | OpenMetadata Governance Guide
slug: /how-to-guides/data-governance/domains-&-data-products/domains
---

## How to Guide to Adding Domains in Open Metadata

This guide will walk you through the steps to add and configure a Domain in Open Metadata. Follow these steps to organize your data assets effectively.

### Step 1: Provide a Name & Display Name for the Domain

- **Name**: Enter a unique identifier for your domain. This will be used internally within the system.
- **Display Name**: Enter a user-friendly name that will be displayed in the user interface. This should be easily recognizable and descriptive.

### Step 2: Provide a Description for the Domain

- **Description**: Write a detailed description of the domain. This should explain the purpose of the domain, the types of data it contains, and any other relevant information that will help users understand its context and usage.

### Step 3: Select Your Domain Type

- Open Metadata provides three types of domains:
  - **Source-aligned**: Domains closer to online services and transactional databases, including events and transactional data.
  - **Aggregate**: Domains that collect and curate data from multiple source-aligned domains to provide aggregated data and data products, such as Customer 360.
  - **Consumer-aligned**: User-facing domains where the end product combines data from various domains for business users or data citizens for decision-making.

- **Selecting a Domain Type**: Choose the type that best fits the purpose and structure of your domain.

### Step 4: Select the Owner/Experts of the Domain

- **Owner/Experts**: Assign ownership and expertise to the domain by selecting users or teams responsible for it. This helps in managing the domain and provides a point of contact for queries and maintenance.

### Step 5: Add Data Assets to the Domain

- Once the domain is created, you can start adding data assets to it. This includes datasets, tables, dashboards, and other relevant assets.
- **Adding Data Assets**: Navigate to the domain and use the interface to add and categorize your data assets appropriately.

### Step 6: Filter Data Assets by Domain on the Explore Page

- **Explore Page**: Use the Explore page to filter and view data assets assigned to different domains. This helps in easily locating and accessing data assets within specific domains.

{% image
  src="/images/v1.7/how-to-guides/governance/domains.gif"
  alt="Domains"
 /%}

By following these steps, you can effectively set up and manage domains in Open Metadata, ensuring a well-organized and efficient data architecture.


{%inlineCalloutContainer%}
 {%inlineCallout
  color="violet-70"
  bold="How to Use Data Products"
  icon="MdDiscount"
  href="/how-to-guides/data-governance/domains-&-data-products/data-products"%}
   Learn about the Data Products.
 {%/inlineCallout%}
{%/inlineCalloutContainer%}
