---
title: Add Complex Queries using Advanced Search
slug: /how-to-guides/data-discovery/advanced
---

# Add Complex Queries using Advanced Search

In case of voluminous data, the advanced search option helps to narrow down the search results for data discovery. The query builder supports multiple conditions as well as grouped conditions to simplify search.

{% note noteType="Tip" %} The advanced search option is a quick and easy to use UI query builder to support complex queries for data discovery. {% /note %}

To use the advanced search for complex queries:
- Navigate to the Explore page and click on the **Advanced** option on the top right

{% image
src="/images/v1.9/how-to-guides/discovery/adv1.png"
alt="Advanced Search"
caption="Advanced Search"
/%}

- Using the **Syntax Editor**, select the **Field** you would like like to search by. Currently, the following fields are supported: Deleted, Owner, Tags, Tier, Service, Database, Database Schema, and Column.
- Select the required **Conditions** for your query. The following fields are supported: Equal to, Not equal to, Any in, Not in, Contains, and Does not contain. The conditions will vary based on the field selected.
- Add in the values for the **Criteria**.
- You can add multiple conditions and group the conditions together.
- Use the AND/OR conditions. Select `AND` to ensure that all the conditions are satisfied. Select `OR` to ensure that any one of the conditions is satisfied.

{% image
src="/images/v1.9/how-to-guides/discovery/adv2.png"
alt="Add Complex Queries using Advanced Search"
caption="Add Complex Queries using Advanced Search"
/%}

For example, we can set up a complex query as follows:
- Group one set of conditions together by defining the `Owner`. You can add multiple conditions to define different owners and use the `OR` condition to ensure that the owner is any one among them.

{% note noteType="Tip" %} 
### Note on Custom Properties in Elasticsearch Search

Elasticsearch does not support searching for custom properties with the following formats: 

- **Time**
- **DateTime**
- Any date formats other than `yyyy-MM-dd`

Please ensure that custom properties adhere to these constraints for compatibility with Elasticsearch search functionality.

{% /note %}

{% image
src="/images/v1.9/how-to-guides/discovery/adv3.png"
alt="Grouped Condition based on the Owner of the Data Assets"
caption="Grouped Condition based on the Owner of the Data Assets"
/%}

- Next, you can add another set of conditions specific to the data based on the Service, Database, Schema, or Columns. **Apply** the conditions to search.

{% image
src="/images/v1.9/how-to-guides/discovery/adv4.png"
alt="Advanced Search Conditions"
caption="Advanced Search Conditions"
/%}

{% image
src="/images/v1.9/how-to-guides/discovery/adv5.png"
alt="Advanced Search Results"
caption="Advanced Search Results"
/%}