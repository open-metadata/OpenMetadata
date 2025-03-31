---
title: Managing and Editing Foreign Key Constraints in OpenMetadata
slug: /how-to-guides/data-discovery/foreign-key-constraints
---

# Foreign Key Constraints

​In OpenMetadata, **foreign key constraints** are integral to understanding the relationships between tables, enhancing data discovery, and facilitating comprehensive data lineage tracking. By default, the ingestion process captures these constraints, allowing users to visualize and manage table relationships effectively.​

## Viewing Foreign Key Constraints

Once the metadata ingestion is complete, foreign key relationships can be explored within the OpenMetadata UI:​

## Viewing Foreign Key Constraints

Once the metadata ingestion is complete, foreign key relationships can be explored within the OpenMetadata UI:​

### Navigate to the Table Details Page:
- Access the desired table within the OpenMetadata interface.

{% image
src="/images/v1.7/how-to-guides/discovery/foreign-key1.png"
alt="Navigate to the Table Details Page"
caption="Navigate to the Table Details Page"
/%}

### Explore Table Constraints:
- Foreign key constraints are displayed, detailing the relationships between the current table and its related tables. [OpenMetadata Docs+6GitHub+6OpenMetadata Docs+6](https://github.com/open-metadata/OpenMetadata/issues/10583)

{% image
src="/images/v1.7/how-to-guides/discovery/foreign-key2.png"
alt="Explore Table Constraints"
caption="Explore Table Constraints"
/%}

This visualization aids in understanding data dependencies and supports effective data governance.​

## Editing Foreign Key Constraints:

To modify foreign key constraints:[​GitHub](https://github.com/open-metadata/OpenMetadata/issues/2895)

### Ensure Appropriate Permissions:
- Confirm that you have the necessary edit permissions for the table.​

### Access the Table's Schema:
- Navigate to the table's schema view within the OpenMetadata UI.​

{% image
src="/images/v1.7/how-to-guides/discovery/foreign-key1.png"
alt="Access the Table's Schema"
caption="Access the Table's Schema"
/%}

### Modify Constraints:
- Edit the foreign key constraints as required.​

{% image
src="/images/v1.7/how-to-guides/discovery/foreign-key3.png"
alt="Modify Constraints"
caption="Modify Constraints"
/%}

If the editing options are unavailable, it may indicate insufficient permissions or that the feature is not supported in your current OpenMetadata version. In such cases, consider upgrading to the latest version or consulting your administrator.​
