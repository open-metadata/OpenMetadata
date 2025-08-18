---
title:  Domains & Data Products | Official Documentation
description: Manage domains and data products to establish ownership, scope, and data product lineage within your ecosystem.
slug: /how-to-guides/data-governance/domains-&-data-products
---

# Domains and Data Products

## Overview of Domains and Data Products in Open Metadata

In Open Metadata, we've added support for Data Mesh with Domains and Data Products, enabling you to efficiently manage and organize your data assets. Here’s how you can leverage these features to enhance your data architecture and improve user experience:

## Organizing with Domains

Domains in Open Metadata allow you to categorize and manage your data assets, glossaries, teams, and other entities under a unified structure. This supports a decentralized data architecture by:

- **Grouping Related Data**: You can group related data assets within a domain, making it easier to manage and maintain them.
- **Streamlined Management**: By associating teams and glossaries with specific domains, you can streamline the governance and oversight of data assets.
- **Decentralized Control**: Each domain can be managed independently, aligning with the principles of a Data Mesh, where data ownership is distributed across different teams.

## Domains

In the context of a data mesh, a domain refers to a specific area within an organization that produces and consumes data. Each domain is responsible for managing its data as a product, ensuring it is available, reliable, and understandable to other domains within the organization. Domains are typically aligned with business capabilities and are managed by cross-functional teams who are responsible for the entire lifecycle of the data within their domain.

### Key Principles of Domains

1. **Decentralization**: Each domain operates independently, owning and managing its data. This decentralization reduces bottlenecks and allows for more scalable and agile data management.
2. **Domain Ownership**: The domain team is responsible for the data quality, security, and compliance within their scope. This ownership ensures accountability and a higher level of commitment to maintaining high data standards.
3. **Cross-functional Teams**: Domain teams are cross-functional, typically including data engineers, data scientists, product managers, and domain experts. This diversity ensures that all aspects of data management, from technical implementation to business relevance, are covered.
4. **Domain-driven Design**: The design of data products and services is aligned with the business domain, ensuring that the data solutions are directly relevant to business needs and processes.

### Benefits of Domain-based Data Management

- **Improved Data Quality**: With dedicated domain teams, there is a higher focus on data quality and relevance, as the teams are directly accountable for the data they manage.
- **Scalability**: Decentralized domains can scale independently, allowing for more flexible growth and adaptation to changing business requirements.
- **Agility**: Domain teams can rapidly develop and deploy data solutions tailored to their specific needs without waiting for centralized data teams, leading to quicker insights and decision-making.
- **Enhanced Collaboration**: Clear ownership and well-defined interfaces between domains facilitate better collaboration and data sharing across the organization.

## Enhancing Usability with Data Products

Data Products in Open Metadata allow teams to package and present their data assets as products within their domains. This approach benefits data users by:

- **Centralized Access**: Data consumers can easily discover and access all Data Products available within their organization through the Explore page.
- **Comprehensive Documentation**: Each Data Product comes with rich documentation, helping users understand the data’s context, usage, and governance.
- **Metadata Management**: Essential metadata, such as owner information, expert contacts, tags, and styling, can be captured and maintained for each Data Product, enhancing discoverability and usability.

## Data Products

Data products are the core outputs managed by each domain in a data mesh architecture. They are designed to be easily discoverable, understandable, and usable by other domains. Data products can include datasets, analytical models, or data processing pipelines that are created and maintained by a domain team.

### Key Characteristics of Data Products

1. **Discoverability**: Data products should be easily discoverable by other teams within the organization. This often involves maintaining a data catalog or similar repository.
2. **Understandability**: Clear documentation and metadata should be provided to ensure that users can easily understand the data product's contents and usage.
3. **Usability**: Data products should be designed with usability in mind, providing well-defined interfaces and APIs to facilitate easy integration and use by other domains.
4. **Reliability**: Data products must be reliable and maintain high quality, ensuring they can be trusted by users across the organization.
5. **Interoperability**: Data products should be interoperable, allowing seamless integration with other data products and systems within the data mesh.

### Examples of Data Products

- **Analytical Data Models**: Models built for analyzing data to support decision-making processes within the organization.
- **Streaming Data Products**: Data products that are designed to handle real-time data streams, enabling immediate insights and actions based on current data.
- **Data Pipelines**: Automated processes for collecting, transforming, and loading data from various sources into a usable format.

## Domain-Only View for Simplified User Experience

To further enhance user experience, Open Metadata introduces a Domain-only View. This feature helps users by:

- **Focused Navigation**: Users can stay within a specific domain for all their data needs, reducing the complexity of navigating across multiple domains.
- **Enhanced Discoverability**: Within a domain, users can quickly find the data assets and products relevant to their work, improving efficiency and productivity.

## Implementing Domains and Data Products

1. **Setting Up Domains**:
   - Define your organizational structure and identify key domains.
   - Categorize your data assets, glossaries, and teams under the appropriate domains.
   - Assign ownership and governance responsibilities to relevant teams within each domain.

2. **Creating Data Products**:
   - Group related data assets from within a domain to form a Data Product.
   - Provide comprehensive documentation and metadata for each Data Product.
   - Ensure each Data Product has clear ownership and designated experts for support.

3. **Utilizing the Domain-only View**:
   - Encourage users to navigate and operate within their designated domains.
   - Provide training and resources to help users leverage the Domain-only View effectively.
   - Regularly update and maintain domain structures and Data Products to reflect organizational changes and evolving data needs.

By organizing your data assets with Domains and Data Products in Open Metadata, you can achieve a more structured and efficient data management system. This approach supports decentralized data architecture, simplifies user experience, and enhances discoverability and usability of data across your organization. Embrace these features to optimize your data strategy and empower your teams with better data tools.

For more detailed information, you can visit the [Data Mesh Architecture website](https://www.datamesh-architecture.com/).


{%inlineCalloutContainer%}
 {%inlineCallout
  color="violet-70"
  bold="How to Use Domains"
  icon="MdDiscount"
  href="/how-to-guides/data-governance/domains-&-data-products/domains"%}
  Learn about the Domains.
 {%/inlineCallout%}
 {%inlineCallout
  color="violet-70"
  bold="How to Use Data Products"
  icon="MdDiscount"
  href="/how-to-guides/data-governance/domains-&-data-products/data-products"%}
   Learn about the Data Products.
 {%/inlineCallout%}
{%/inlineCalloutContainer%}