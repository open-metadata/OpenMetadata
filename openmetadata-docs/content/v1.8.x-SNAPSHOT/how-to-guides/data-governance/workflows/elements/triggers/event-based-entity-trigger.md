---
title: Governance Workflows - Event Based Entity Trigger
slug: /how-to-guides/data-governance/workflows/elements/triggers/event-based-entity-trigger
collate: true
---

# Governance Workflows - Event Based Entity Trigger

The **Event Based Entity Trigger** enables actions to be initiated based on specific events related to an entity.
These triggers are essential for automating workflows in response to entity state changes, such as when an entity is created or updated.
The trigger listens for predefined events and can be configured to exclude certain attribute modifications.

## Configuration

First you need to specify a **Data Asset** on which the Workflow will operate

Then, the Trigger can be configured to respond to the following events:

- **Created**: Triggered when a new entity is created.
- **Updated**: Triggered when an existing entity is updated.

Additionally, this trigger allows fine-tuning by excluding certain events that modify only specific attributes of the entity.


### Example

As an example we can check the default **Glossary Approval Workflow**, shipped with Collate.

{% image src="/images/v1.8/how-to-guides/governance/workflows-event-based-entity-trigger.png" alt="event-based-entity-trigger-example" /%}
