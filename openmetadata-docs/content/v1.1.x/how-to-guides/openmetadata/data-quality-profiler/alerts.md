---
title: How to Set Alerts for Test Case Fails
slug: /how-to-guides/openmetadata/data-quality-profiler/alerts
---

# How to Set Alerts for Test Case Fails

Users can set up alerts to be notified when data quality tests fail.

To set up an alert for test failures:
- Navigate to **Settings >> Alerts**
- Click on **Create Alert**

{% image
src="/images/v1.1/how-to-guides/quality/alert1.png"
alt="Set up Alerts for Test Failure"
caption="Set up Alerts for Test Failure"
/%}

Enter the following details:
- **Name:** Add a name for the alert.
- **Description:** Describe what the laert is for.
- **Trigger:** Uncheck the trigger for `All` and add a trigger for `Test Case`
- **Filters:** Add filters to narrow down to the `Test Results` which `Failed`. You can also add another filter to specify the `FQN` to only include the tables that you want to consider.
- **Destination:** Specify the destination where the test failed notification must be sent. The alerts can be sent to Email, Slack, MS Teams, Google Chat, and other Webhooks. Notifications can also be sent only to Admins, Owners and Followers of data assets.

{% image
src="/images/v1.1/how-to-guides/quality/alert2.png"
alt="Configure an Alert for Test Failure"
caption="Configure an Alert for Test Failure"
/%}

**Save** the details to create an Alert.