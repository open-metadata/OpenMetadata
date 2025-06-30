---
title: Adding Auto Classification Workflow through UI
slug: /how-to-guides/data-governance/classification/auto-classification/workflow
---

# Adding Auto Classification Agent through the UI

Follow these steps to configure Auto Classification Agent via the OpenMetadata UI:

## 1. Navigate to the Database Service
- Go to **Settings > Services > Databases** in the OpenMetadata UI.
- Select the database for which you want to configure Auto Classification Agent.

{% image
src="/images/v1.8/how-to-guides/governance/ac-1.png"
alt="Settings"
caption="Settings"
/%}

{% image
src="/images/v1.8/how-to-guides/governance/ac-1.1.png"
alt="Services"
caption="Services"
/%}

{% image
src="/images/v1.8/how-to-guides/governance/ac-2.png"
alt="Databases"
caption="Databases"
/%}

## 2. Access the Agents Tab
- In the selected database, navigate to the **Agents** tab.
- Click on the option to **Add Auto Classification Agent**, as shown in the example image.

{% image
src="/images/v1.8/how-to-guides/governance/ac-3.png"
alt="Access the Agents Tab"
caption="Access the Agents Tab"
/%}

## 3. Configure Auto Classification Details
- Fill in the details for your Auto Classification Agent workflow.
- Each field's purpose is explained directly in the UI, allowing you to customize the configuration based on your requirements.

{% image
src="/images/v1.8/how-to-guides/governance/ac-4.png"
alt="Configure Auto Classification Details"
caption="Configure Auto Classification Details"
/%}

- By default, the store sample data option is enabled. If you prefer not to ingest sample data during a scheduled run, please ensure that this option is disabled in the Agent configuration.

{% image
src="/images/v1.8/how-to-guides/governance/acnew.png"
alt="Disable sample data"
caption="Disable sample data"
/%}

## 4. Set the Schedule
- Specify the time interval at which the Auto Classification Agent should run.

{% image
src="/images/v1.8/how-to-guides/governance/ac-5.png"
alt="Set the Schedule"
caption="Set the Schedule"
/%}

## 5. Add the Agent Workflow
- Once all details are configured, click **Add Auto Classification Agent** to save and activate the workflow.

{% image
src="/images/v1.8/how-to-guides/governance/ac-6.png"
alt="Add the Agent Workflow"
caption="Add the Agent Workflow"
/%}

By following these steps, you can set up an Auto Classification Agent workflow to automatically identify and tag sensitive data in your databases.
