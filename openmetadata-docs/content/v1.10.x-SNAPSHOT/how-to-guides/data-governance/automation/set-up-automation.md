---
title: How to Set Up Automations in OpenMetadata
slug: /how-to-guides/data-governance/automation/set-up-automation
collate: true
---

# How to Set Up Automations in Collate

### Step 1: Access the Automations Section
In the OpenMetadata UI, navigate to **Govern>Automations**.  
This will take you to the Automations page where you can view and manage your existing automations.

{% image
src="/images/v1.10/how-to-guides/governance/automation-1.png"
alt="Getting started with Automation"
caption="Getting started with Automation"
/%}

### Step 2: Add a New Automation
In the Automations page, click the **Add Automation** button located at the top right of the page.  
A pop-up window will appear to begin the process of adding a new automation.

{% image
src="/images/v1.10/how-to-guides/governance/automation-2.png"
alt="Add Automation"
caption="Add Automation"
/%}

### Step 3: Fill in Automation Details

In the pop-up window, provide the necessary information to set up the automation:

- **Automation Name**: Give a meaningful name to the automation for easy identification.
- **Description**: Add a brief description explaining what this automation will do (e.g., "Daily metadata ingestion for database XYZ").
- **Logic/Conditions**: Define any conditions or specific criteria needed for this automation to work (e.g., specific tables or columns to be included). Ensure that the logic is set up as per your specific requirements to make the automation effective for your workflows.

Additionally, use the **Apply to Child** option to add a list of **tags** and **glossary terms** to selected assets at the column level:
   - If a list of columns is specified, tags will only be applied to columns with matching names.
   - By default, incoming tags will merge with existing tags. 
   - To overwrite existing tags with the new list, select the **Overwrite Metadata** option, replacing any previous tags with the incoming ones.

Ensure each setting aligns with your automation requirements to maximize efficiency.

{% image
src="/images/v1.10/how-to-guides/governance/automation-4.png"
alt="Automation details"
caption="Automation details"
/%}

{% image
src="/images/v1.10/how-to-guides/governance/automation-5.png"
alt="Automation logics"
caption="Automation logics"
/%}

### Step 4: Configure Automation Interval
Once you've filled in the required details, click **Next**.  
On the next page, you’ll be prompted to select the interval for the automation. This defines how frequently the automation should run (e.g., daily, weekly, or custom intervals).  
Review your settings and click **Automate** once you are satisfied with the configuration.

{% image
src="/images/v1.10/how-to-guides/governance/automation-6.png"
alt="Automation Interval"
caption="Automation Interval"
/%}

### Step 5: Manage Your Automation
After completing the setup, your automation will appear in the Automations list.  
To manage the automation, click on the three dots next to the automation entry. From here, you can **edit**, **re-deploy**, **delete**, etc.

{% image
src="/images/v1.10/how-to-guides/governance/automation-7.png"
alt="Manage Your Automation"
caption="Manage Your Automation"
/%}
