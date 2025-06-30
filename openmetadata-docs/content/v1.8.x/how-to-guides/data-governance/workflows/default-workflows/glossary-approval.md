---
title: Governance Workflows - Glossary Approval Workflow (Default)
slug: /how-to-guides/data-governance/workflows/default-workflows/glossary-approval
collate: true
---

# Governance Workflows - Glossary Approval Workflow (Default)

The **Glossary Approval Workflow** in Collate helps organizations maintain a high-quality, standardized business glossary by introducing a structured review and approval process for glossary terms.

## Overview

A business glossary is critical for ensuring consistent terminology across an organization. The glossary approval workflow ensures that each newly added term is carefully reviewed and approved before being published for organization-wide use. This process helps prevent duplication, incomplete definitions, and outdated terms.

{% image src="/images/v1.8/how-to-guides/governance/workflows-glossary-approval.png" alt="glossary-approval" /%}

## Key Features

### Term Review and Approval

- **Draft State**: When a new term is created, it enters a draft state.
- **Review Assignment**: A task is automatically assigned to designated reviewers for that glossary.

### Approval Process:

- Only assigned reviewers can approve or reject terms.
- Approved terms move to an **Approved** state and become available for wider use.
- Rejected terms remain unpublished to preserve glossary integrity.

### In-App Collaboration

- Reviewers can view and edit term details directly in Collate.
- Team members can collaborate using **comments** and **@mentions** to discuss terms and provide feedback before approval.

### Auto-Approval for Glossaries Without Reviewers

- If no reviewer is assigned to a glossary, terms are **approved automatically** upon creation.

## Benefits

- **Consistency**: Prevents redundant or conflicting terminology.
- **Quality Control**: Ensures all terms are meaningful, complete, and accurate.
- **Governance**: Provides visibility and control over glossary content and curation.
- **Collaboration**: Facilitates discussion and consensus before terms are finalized.

## How to Enable

To activate the approval workflow:

1. Assign one or more reviewers to the glossary.
2. Once assigned, any newly added term will initiate the approval process.

{% image src="/images/v1.8/how-to-guides/governance/workflows-glossary-approval1.png" alt="glossary-approval-process" /%}

3. One can check the configuration of the glossary term by clicking on data asset in **Workflow**.

{% image src="/images/v1.8/how-to-guides/governance/workflows-glossary-approval2.png" alt="glossary-approval-workflow" /%}

Glossary approval is an essential component of your data governance strategy. It ensures that business terms are properly defined, reviewed, and managed, supporting improved data understanding and usage across your organization.
