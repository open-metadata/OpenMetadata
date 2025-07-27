---
title: Governance Workflows - Table Certification Workflow (Default)
description: Automate table certification using default workflows that route assets through validation and ownership stages.
slug: /how-to-guides/data-governance/workflows/default-workflows/table-certification
collate: true
---

# Governance Workflows - Table Certification Workflow (Default)

Collate introduces a Data Governance Automation Framework that enables customizable certification workflows to classify data assets—such as tables and dashboards—into Bronze, Silver, or Gold categories. This helps ensure that users can easily identify well-managed and trusted data assets.

## Overview

Without standardized certification, data teams may face challenges in identifying correct, actively-used assets with complete and up-to-date documentation. The **Table Certification Workflow** addresses this issue by enforcing validation rules and assigning visual certification badges.

## Certification Classification

Navigate to the **Classification** tab in the UI to view the predefined certification levels:

- **Gold**: Highest level of trust and documentation completeness.
- **Silver**: Moderate level with essential documentation and ownership.
- **Bronze**: Basic level indicating partial metadata completeness.
- **Uncertified**: Assets that do not meet any predefined criteria.

## Workflow Features

### Customizable Validation Rules

Each certification level (**Gold**, **Silver**, **Bronze**) is determined based on customizable criteria such as:

- Ownership assignment  
- Presence of description  
- Tag classification (e.g., Tier)  
- Custom properties

{% image src="/images/v1.7/how-to-guides/governance/workflows-table-certification.png" alt="table-certification" /%}

## Trigger Options

Certification workflows can be triggered:

- **On a scheduled basis** (e.g., daily, weekly)
- **On-demand** via the user interface

{% image src="/images/v1.7/how-to-guides/governance/workflows-table-certification1.png" alt="table-certification-trigger" /%}

## Certification Indicators

Once the workflow is executed:

- Certified assets are marked with a **badge** next to their name, indicating their certification level.
- This **visual cue** helps users quickly assess the quality and reliability of the asset.

{% image src="/images/v1.7/how-to-guides/governance/workflows-table-certification2.png" alt="table-certification-indicators" /%}

## Examples

| Asset Description                               | Certification Level |
|------------------------------------------------|---------------------|
| Has description, owner, and Tier 1 tag         | Gold                |
| Has description, owner, and Tier 2 tag         | Silver              |
| Has description and owner but no Tier tag      | Bronze              |
| Lacks description, owner, and tier             | Uncertified         |

{% image src="/images/v1.7/how-to-guides/governance/workflows-table-certification3.png" alt="table-certification-asset-description" /%}

## Benefits

- Helps enforce governance best practices  
- Makes it easy to distinguish between trusted and unmanaged data assets  
- Encourages data curation and improves metadata quality  
- Supports both proactive and reactive data certification strategies
