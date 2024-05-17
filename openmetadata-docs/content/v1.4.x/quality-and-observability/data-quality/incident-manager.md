---
title: Incident Manager
slug: /quality-and-observability/data-quality/incident-manager
---

# Incident Manager

## Opening and Triagging Incidents
 In v1.1.0 we introduce the ability for user to manage and triagge incidents linked to failures. When a test case fail, it will automatically open a new incident and mark it as new. if enough information is available, OpenMetadata will automatically assign a severity to the incident - note that you can override this severity. It indicates that a new failure has happened.

{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/resolution-workflow-new.png"
  alt="Test suite results table"
  caption="Test suite results table"
 /%}

Once an incident has been open you will be able to triagge and manage it. You can perform different actions at this stage:
- `ack`: the incident will be mark as acknoweldge, informing users that people are aware of the on going incident.
- `assign`: the incident will be marked as assigned and a task will be opened for the assignee.
- `resolved`: a new incident can directly be marked as resolved - see section below for more details

{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/resolution-workflow-ack-form.png"
  alt="Test suite results table"
  caption="Test suite results table"
 /%}
{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/resolution-workflow-ack.png"
  alt="Test suite results table"
  caption="Test suite results table"
 /%}

When resolving and incident a user will be required to specify the reason and add a comment. This provides context regarding the incident and helps users further understand what might have gone wrong

{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/resolution-workflow-resolved-form.png"
  alt="Test suite results table"
  caption="Test suite results table"
 /%}

{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/resolution-workflow-resolved.png"
  alt="Test suite results table"
  caption="Test suite results table"
 /%}


## Incidents Context & History

When clicking on an open incident you will different information:
**Open Incident:** this section will show you open incidents with the timeline and any comments/collaboration that might have been happening.
**Closed Incidents:** this section will show you incidents that have been resolved in the past with the timeline and any comments/collaboration that might have been happening and the resolution reason.

{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/incident-management-page.png"
  alt="Test suite results table"
  caption="Test suite results table"
 /%}