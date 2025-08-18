---
title: Autopilot Application
slug: /applications/autopilot
collate: true
---

# Autopilot Application

{% youtube videoId="PKvKWZ8vseU" start="0:00" end="1:45" width="800px" height="450px" /%}

The **Autopilot Application** simplifies and accelerates the onboarding of new data services by automatically deploying and triggering essential ingestion workflows.  
With minimal input—just the service connection details—Autopilot sets up the entire metadata ingestion process using well-defined defaults.

## Overview

Autopilot is designed to help users get started quickly with metadata ingestion for newly added services by automating:

- **Metadata ingestion**
- **Lineage extraction**
- **Usage statistics collection**

> **Note:**  
> Workflows like **Profiler** and **Auto Classification** are created but not run automatically, allowing teams to review and selectively execute them based on resource and cost considerations.

## Key Benefits

- **Fast Setup:** Start ingesting metadata by simply defining the connection.
- **Automated Deployment:** Automatically configures and deploys ingestion workflows.
- **Editable Configurations:** All generated workflows can be reviewed and updated later.
- **Integrated Insights:** Service insights are immediately available post-ingestion, highlighting areas that need further enrichment.

## Installation

1. Navigate to **Settings > Applications**.
2. Click **Add Apps** and select **Autopilot** from the marketplace.

{% image
src="/images/v1.10/applications/autopilot.png"
alt="Select Autopilot Application"
caption="Select Autopilot Application"
/%}

3. Click **Install**.

{% image
src="/images/v1.10/applications/autopilot1.png"
alt="Install Autopilot"
caption="Install Autopilot"
/%}

## Configuration

Once installed, configure the application by filling in the following fields:

| Parameter            | Description |
|:----------------------|:------------|
| **Application Type**  | Set to `AutoPilotAppConfig`. |
| **Active**            | Enable to activate the workflow for the selected service. |
| **Service Entity Link** | Link the service for which the ingestion workflows should be triggered. |

{% image
src="/images/v1.10/applications/autopilot2.png"
alt="Configuration"
caption="Configuration"
/%}

## How It Works

1. **Define Connection:**  
   Create a new service (e.g., Snowflake) and test the connection.

2. **Apply Filters:**  
   Add filter sets that will be inherited by all workflows.

3. **Autopilot Activation:**  
   Once configured, Autopilot deploys and runs the following workflows:
   - Metadata Ingestion
   - Usage
   - Lineage

4. **Selective Execution:**  
   Profiler and Auto Classification workflows are created but not executed automatically, giving you control over profiling scope and cost.

## Post-Ingestion Insights

After the initial run:

- Navigate to **Service Insights** to view KPIs such as:
  - Description coverage
  - PII detection
  - Data asset tiers

- Use the insights to identify areas that need enrichment—e.g., tagging, ownership, documentation.
