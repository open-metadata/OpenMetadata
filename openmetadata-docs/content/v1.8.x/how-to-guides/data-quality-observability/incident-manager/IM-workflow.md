---
title: How to work with the Incident Manager | Official Documentation
description: Explore incident workflows that document, notify, and assign resolution steps for quality issues across assets.
slug: /how-to-guides/data-quality-observability/incident-manager/workflow
---

# How to Work with the Incident Manager Workflow

## 1. Incident Dashboard

The Incident Dashboard is the central hub where all incidents are displayed. Users can filter incidents by various criteria to manage and prioritize them effectively. 

### Filters Available:
- **Assignee:** View incidents assigned to specific team members.
- **Status:** Filter incidents based on their current status (e.g., New, ACK, Assigned, Resolved).
- **Test Cases:** Filter incidents associated with specific test cases.
- **Time:** Sort incidents by the time they were reported or last updated.

{% image
src="/images/v1.8/how-to-guides/observability/incident-manager-1.png"
alt="Incident Manager Dashboard"
caption="Incident Manager Dashboard"
/%}

## 2. Incident Status Change

Incident status can be updated to reflect the current stage of the incident resolution process. The owner of the incident has the ability to assign it to an appropriate assignee for further action.

### Steps to Change Incident Status:
1. Navigate to the Incident Dashboard.
2. Select the incident that needs a status update.
3. Choose the new status from the dropdown menu.
4. Assign the incident to the appropriate team member.
5. You can review the Test Case Details.

{% image
src="/images/v1.8/how-to-guides/observability/incident-manager-2.png"
alt="Incident Test Case Details"
caption="Incident Test Case Details"
/%}

{% image
src="/images/v1.8/how-to-guides/observability/incident-manager-3.png"
alt="Incident Status Change"
caption="Incident Status Change"
/%}

## 3. Incident Resolution

Once an incident has been resolved, it can be officially closed. Ensure to describe a Root Cause Analysis (RCA) in the comments to provide context and understanding of the resolution process.

### Steps to Resolve and Close an Incident:
1. Verify that all necessary steps to resolve the incident have been completed.
2. Describe the RCA in the resolution comments.
3. Change the status of the incident to 'Resolved'.
4. Confirm the closure to update the incident in the dashboard.

{% image
src="/images/v1.8/how-to-guides/observability/incident-manager-4.png"
alt="Incident Resolution"
caption="Incident Resolution"
/%}

## 4. Incident Activities

Each incident includes a detailed timeline where all relevant information is consolidated. This timeline provides a comprehensive view of the incident's lifecycle, including key events, RCA documentation, and closure updates.

### How to View Incident Activities:
1. Open the incident from the Incident Dashboard.
2. Navigate to the 'Incident' tab within the incident details.
3. Review the chronological events, RCA, and closure updates associated with the incident.

{% image
src="/images/v1.8/how-to-guides/observability/incident-manager-5.png"
alt="Incident Activities"
caption="Incident Activities"
/%}
