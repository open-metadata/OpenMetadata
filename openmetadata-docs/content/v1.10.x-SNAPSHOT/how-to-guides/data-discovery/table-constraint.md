---
title: Managing and Editing Table Constraint in OpenMetadata
description: Learn how to view, edit, and manage table constraints in OpenMetadata to track relationships, enhance lineage, and support data governance.
slug: /how-to-guides/data-discovery/table-constraint
---

# Table Constraint

 In OpenMetadata, **table constraint** are integral to understanding the relationships between tables, enhancing data discovery, and facilitating comprehensive data lineage tracking. By default, the ingestion process captures these constraints, allowing users to visualize and manage table relationships effectively. 

## Viewing table constraint

Once the metadata ingestion is complete, foreign key relationships can be explored within the OpenMetadata UI: 

### Navigate to the Table Details Page:
- Access the desired table within the OpenMetadata interface.

{% image
src="/images/v1.10/how-to-guides/discovery/foreign-key1.png"
alt="Navigate to the Table Details Page"
caption="Navigate to the Table Details Page"
/%}

### Explore Table Constraints:
- Table constraint are displayed, detailing the relationships between the current table and its related tables. [OpenMetadata referred column for foreign key](https://github.com/open-metadata/OpenMetadata/issues/10583)

{% image
src="/images/v1.10/how-to-guides/discovery/foreign-key2.png"
alt="Explore Table Constraints"
caption="Explore Table Constraints"
/%}

This visualization aids in understanding data dependencies and supports effective data governance. 

## Editing table constraint:

To modify table constraint:[ GitHub](https://github.com/open-metadata/OpenMetadata/issues/2895)

### Ensure Appropriate Permissions:
- Confirm that you have the necessary edit permissions for the table. 

### Access the Table's Schema:
- Navigate to the table's schema view within the OpenMetadata UI. 

{% image
src="/images/v1.10/how-to-guides/discovery/foreign-key4.png"
alt="Access the Table's Schema"
caption="Access the Table's Schema"
/%}

### Modify Constraints:
- Edit the table constraint as required. 

{% image
src="/images/v1.10/how-to-guides/discovery/foreign-key3.png"
alt="Modify Constraints"
caption="Modify Constraints"
/%}

If the editing options are unavailable, it may indicate insufficient permissions or that the feature is not supported in your current OpenMetadata version. In such cases, consider upgrading to the latest version or consulting your administrator. 
