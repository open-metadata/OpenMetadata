---
title: Governance Workflows - Glossary Approval Workflow (Default)
slug: /how-to-guides/data-governance/workflows/default-workflows/glossary-approval
collate: true
---

# Governance Workflows - Glossary Approval Workflow (Default)

The **Glossary Approval Workflow** is designed to define the process of updating the status of Glossary Terms within Collate.
It is triggered when a Glossary Term is created or updated and it ensures it undergoes a review process until it reaches the desired status.

{% image src="/images/v1.6/how-to-guides/governance/workflows-glossary-approval" alt="glossary-approval" /%}

## Workflow Elements

- **Check if Glossary Term has Reviewers**
This task checks whether the glossary term has any reviewers assigned.

If no reviewers are found, the glossary term is directly marked as approved.
If reviewers are found, the workflow moves to **Check if Glossary Term is Ready to be Reviewed**.

- **Check if Glossary Term is Ready to be Reviewed**
This task verifies if the glossary term is ready for review based on the presence of a description.

If the glossary term is ready for review, the workflow moves to **Set Status to 'In Review'**.
If the glossary term is not ready, the workflow moves to **Set Status to 'Draft'**.

- **Set Status to 'In Review'**
If the glossary term is ready, its status is set to "In Review".

- **Set Status to 'Draft'**
If the glossary term is not ready for review, its status is set to "Draft".

- **Approval**
A user approval task where reviewers approve or reject the glossary term.

If the glossary term is *approved* by the reviewers, the workflow moves to **Set Status to 'Approved'**.
If the glossary term is *rejected* by the reviewers, the workflow moves to  **Set Status to 'Rejected'**.

- **Set Status to 'Approved'**
If the glossary term is approved, its status is updated to "Approved".

- **Set Status to 'Rejected'**
If the glossary term is rejected, its status is updated to "Rejected".
