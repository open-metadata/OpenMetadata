---
title: Governance Workflows - Check Entity Attributes
description: Use this node to check attributes of entities and determine the next step in your data governance workflows based on conditions.
slug: /how-to-guides/data-governance/workflows/elements/nodes/check-entity-attributes
collate: true
---

# Governance Workflows - Check Entity Attributes

The **Check Entity Attributes** node is used to validate whether the attributes of an entity meet specified rules.
This is essential to be able to branch the workflow depending on different characteristics of a given asset, automating decision-making based on it.

## Configuration

After you define a **Display Name** and a **Description** for this node, you can set different rules and branch the workflow.

## Example

We can see an example of this node's configuration below, where we define that it will check:

- That the **Owners** attribute is set.
- That the **Description** attribute is set.

{% image src="/images/v1.7/how-to-guides/governance/workflows-check-entity-attributes.png" alt="check-entity-attributes" /%}
