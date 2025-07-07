---
title: Observability Alerts | OpenMetadata Alerting Guide
slug: /how-to-guides/data-quality-observability/observability/alerts
---

# Observability Alerts
OpenMetadata provides a native way to get alerted in case of test case failure allowing you to proactively resolve data incidents

## Setting Up Alerts
To set up an alert on a test case or test suite, navigate to the observability menu and select `Alerts` and click on `Add Alert`.

{% image
  src="/images/v1.7/features/ingestion/workflows/profiler/alerts-menu.png"
  alt="Alerts Menu"
  caption="Alerts Menu"
 /%}

### Setp 1 - Select a Source
The first will be to select a source. For data quality you have 2 relevant options:
- `Test Case`: it will trigger an alert for the specific test case selected
- `Test Suite`: it will trigger an alert for any test case event linked to the test suite. This is a great way to group alerts and reducing notification fatigue
- `Table`: Schema changes and table metrocs changes
- `Pipeline`: Updates to pipeline assets that you have ingested
- `Ingestion Pipeline (Collate)`: Status changes to your collate ingestion pipelines
- `Container`: Schema changes for the container asset 
- `Topics`: Schema changes for the topic asset

{% image
  src="/images/v1.7/features/ingestion/workflows/profiler/alert-source-selection.png"
  alt="Alerts Menu"
  caption="Alerts Menu"
 /%}


### Step 2 - Select a Filtering Conditon (optional)
**Note:** if you do not set any filter the alert will apply to all test cases or test suite.  

You can filter alerts based on specific condition to narrow down which test suite/test case should trigger an alert. This is interesting for user to dispatch alerts to different channels/users.

{% image
  src="/images/v1.7/features/ingestion/workflows/profiler/alerts-filter.png"
  alt="Alerts Menu"
  caption="Alerts Menu"
 /%}

### Step 3 - Select a Triggering Conditon
Trigger section will allow you set the condition for which an alert should be triggered

{% image
  src="/images/v1.7/features/ingestion/workflows/profiler/alerts-trigger.png"
  alt="Alerts Menu"
  caption="Alerts Menu"
 /%}

### Step 4 - Select a Destination
In the destination section you will be able to select between `internal` and `external` destination:
- `internal`: allow you to select the destination as an internal user, team or admin. The subscription set to this user, team or admin will be use to dispatch the alert
- `external`: allow you to select an external destination such as a slack or teams channel  

{% image
  src="/images/v1.7/features/ingestion/workflows/profiler/alerts-destination.png"
  alt="Alerts Menu"
  caption="Alerts Menu"
 /%}