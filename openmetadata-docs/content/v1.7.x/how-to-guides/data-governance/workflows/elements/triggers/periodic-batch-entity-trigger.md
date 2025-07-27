---
title: Governance Workflows - Periodic Batch Entity Trigger
description: Set up periodic triggers to execute workflows in batches, ideal for regular governance tasks like validations and syncs.
slug: /how-to-guides/data-governance/workflows/elements/triggers/periodic-batch-entity-trigger
collate: true
---

# Governance Workflows - Periodic Batch Entity Trigger

The **Periodic Batch Entity Trigger** enables actions to be triggered on a periodic schedule, processing a batch of entitites at a time.
This type of trigger is useful for automating regular workflows that need to run on a schedule.

## Configuration

First you need to specify a **Data Asset** on which the Workflow will operate

Then you can define different filters to define more specifically the assets you wish you run through this workflow.

Finally you can define the trigger mechanism:

- **On Demand**: Manually triggered from the UI.
- **Schedule**: Triggered on a given schedule

Additionally, this trigger allows to optionally define the BatchSize to improve the fetching performance. **This should not be changed unless truly required.**

### Example

As an example we can check the default **Table Certification Workflow**, shipped with Collate.

{% image src="/images/v1.7/how-to-guides/governance/workflows-periodic-batch-entity-trigger.png" alt="periodic-batch-entity-trigger" /%}
