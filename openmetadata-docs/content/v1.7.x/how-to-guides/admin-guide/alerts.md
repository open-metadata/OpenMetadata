---
title: Set up Data Observability Alerts and Notifications
description: Set up alerts for data quality failures, ingestion issues, or governance rule violations.
slug: /how-to-guides/admin-guide/alerts
---

# Set up Data Observability Alerts and Notifications

OpenMetadata has been providing alerts right from the start to notify users of important data lifecycle events: schema modifications, ownership shifts, and tagging updates. Users can define fine-grained alerts and notifications.

Starting from the 1.3 release, Data Observability alerts have been completely revamped, simplifying the process of monitoring data. Users can quickly create alerts for:
- **Changes in the Metadata:** such as schema changes,
- **Data Quality Failures:** to filter by Test Suite,
- **Pipeline Status Failures:** when ingesting runs from your ETL systems, and
- **Ingestion Pipeline Monitoring:** for OpenMetadata’s ingestion workflows

Depending on your use cases, notifications can be sent to owners, admins, teams, or users, providing a more personalized and informed experience. Teams can configure their dedicated Slack, MS Teams, or Google Chat channels to receive notifications related to their data assets, streamlining communication and collaboration. With the alerts and notifications in OpenMetadata, users can send Announcements over email, Slack, or Teams. Alerts are sent to a user when they are mentioned in a task or an activity feed.

- [Create Observability Alerts](#create-observability-alerts)
- [Add Notifications for Change Events](#add-notifications-for-change-events)
- [Additional Details for the Configuration of Destinations](#additional-details-for-the-configuration-of-destinations)

## Create Observability Alerts

{%inlineCalloutContainer%}
 {%inlineCallout
    icon="MdGppGood"
    bold="Required Permissions"
    href="/how-to-guides/admin-guide/roles-policies"%}
    Setting up alerts requires create permission on the `Eventsubscription` entity. More info here.
 {%/inlineCallout%}
{%/inlineCalloutContainer%}

### Step 1
Navigate to Observability > Alerts.

Once on the Observability alerts page, click on button **Add Alert** in the top right corner.
{% image
src="/images/v1.7/how-to-guides/admin-guide/alert1.webp"
alt="Create Observability Alerts"
caption="Create Observability Alerts"
/%}

### Step 2
Configure your alert.

As with most configuration in OpenMetadata you will first need to add a **Name** and **Description** for your alert. Once this is completed, we can move on to the configuration. You have 4 steps to configure your alert:
1. **Source**: Specify the data asset for which the alert must be set up. Alerts can be set up for Container, Ingestion Pipeline, Pipeline, Table, Test Case, Test Suite, and Topic.

{% image
src="/images/v1.7/how-to-guides/admin-guide/source.webp"
alt="Specify the Data Asset"
caption="Specify the Data Asset"
/%}

2. **Filter**: Specify the change events to narrow the scope of your alerts. Filters are based on source selected. For example, if the source is a Table, then you can filter by Table Name, Domain, or Owner Name. Use the toggle button to **Include** or **Exclude** the selected filter option. Selecting **Include** will result in an alert being sent if the condition is met. If the Include toggle is turned off, then the condition will be silenced and an alert will not be sent for the denied event. You can add multiple filters.

{% image
src="/images/v1.7/how-to-guides/admin-guide/filter.webp"
alt="Define the Filter"
caption="Define the Filter"
/%}

{% image
src="/images/v1.7/how-to-guides/admin-guide/filter2.webp"
alt="Include/Exclude the Filter"
caption="Include/Exclude the Filter"
/%}

3. **Trigger**: Select important trigger events like 'Schema Change' or 'Test Failure' to generate an alert. Triggers are based on the source selected. For example,  
- Schema changes, 
- Ingestion pipeline status update (Failed, Partial Success, Queued, Running, Success), 
- Pipeline status update (Failed, Pending, Skipped, Successful), 
- Table metrics update, 
- Test case status updates (Aborted, Failed, Queued, Success)
- Test case status belonging to a test suite (Aborted, Failed, Queued, Success)

Multiple triggers can be added.

{% image
src="/images/v1.7/how-to-guides/admin-guide/trigger.webp"
alt="Select Important Trigger Events"
caption="Select Important Trigger Events"
/%}

4. **Destination**: Specify the destination for the alerts. OpenMetadata supports sending alerts to the users within OpenMetadata, i.e., **Internal** such as Admins, Followers, Owners, Teams and Users.

{% image
src="/images/v1.7/how-to-guides/admin-guide/internal.webp"
alt="Send Alerts to the Users and Teams within OpenMetadata"
caption="Send Alerts to the Users and Teams within OpenMetadata"
/%}

Alerts can be sent to **External** sources like **Email, G Chat, Generic Webhooks, MS Teams, and Slack**. Add the endpoint URL for the destinations. Alerts can be sent to multiple destinations.

{% image
src="/images/v1.7/how-to-guides/admin-guide/external.webp"
alt="Send Alerts to Email, Slack, Teams, G Chat, & Webhooks"
caption="Send Alerts to Email, Slack, Teams, G Chat, & Webhooks"
/%}

## Add Notifications for Change Events
In addition to setting up observability alerts, you can also set up notifications to get timely alerts on various change events.

### Step 1
Navigate to Settings > Notifications. Once on the Notifications page, click on button **Add Alert** in the top right corner.

{% image
src="/images/v1.7/how-to-guides/admin-guide/notify.webp"
alt="Add Notifications for Change Events"
caption="Add Notifications for Change Events"
/%}

{% image
src="/images/v1.7/how-to-guides/admin-guide/alert2.webp"
alt="Add an Alert"
caption="Add an Alert"
/%}

### Step 2
Configure your notifications.

Add a **Name** and **Description** for your notification. Configure the notification by adding the details for the below 3 steps:
1. **Source**: Specify the data asset for which the notification must be set up. Notifications can be set up for Announcements, Chart, Conversation, Dashboard, Dashboard Data Model, Dashboard Service, Database, Database Schema, Database Service, Glossary, Glossary Term, Ingestion Pipeline, Location, Messaging Service, Metadata Service, ML Model, ML Model Service, Pipeline, Pipeline Service, Storage Service, Table, Tag, Tag Category, Task, Topic, or for all the data assets.

{% image
src="/images/v1.7/how-to-guides/admin-guide/source2.webp"
alt="Specify the Data Asset"
caption="Specify the Data Asset"
/%}

2. **Filter**: Specify the change events to narrow the scope of your alerts. Filters are based on source selected. For example, Owner, Entity FQN, Event Type, Updater Name, Domain, General Metadata Events, or Mentioned Users. 

Use the toggle button to **Include** or **Exclude** the selected filter option. Selecting **Include** will result in a notification being sent if the condition is met. If the Include toggle is turned off, then the condition will be silenced and a notification will not be sent for the denied event. You can add multiple filters.

{% image
src="/images/v1.7/how-to-guides/admin-guide/filter3.webp"
alt="Define the Filter"
caption="Define the Filter"
/%}

3. **Destination**: Specify the destination for the notifications. OpenMetadata supports sending notifications to the users within OpenMetadata, i.e., **Internal** such as Admins, Followers, Owners, Teams and Users. Notifications can be sent to **External** sources like Email, G Chat, Generic Webhooks, MS Teams, and Slack. Add the endpoint URL for the destinations. Notifications can be sent to multiple destinations.

## Additional Details for the Configuration of Destinations

{% partial file="/v1.7/how-to-guides/email.md" /%}

### Slack
For Slack configuration you will need to get the endpoint URL of the channel where you wish to send the alerts. Additionally, you can configure the following parameters:
- **Batch Size**: Size of the batch that will be sent to the endpoint.
- **Connection Timeout**: Timeout for the connection.
- **Secret Key**: Secret key can be used to secure the webhook connection.

### MS Teams
For MS Teams configuration you will need to get the endpoint URL of the channel where you wish to send the alerts. You can find this by going to the Teams channel where you want the posts to appear. Click on the three dots `...`, and click on "Connectors".  Then add the "Incoming Webhook" connector.  Copy this connector's URL and add it in OpenMetadata.  It may be in the form of `https://your-domain.webhook.office.com/webhookb2/...@.../IncomingWebhook/.../...`.  For more on MS Teams webhooks, see [Create an Incoming Webhook](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook). Additionally, you can configure the following parameters:
- **Batch Size**: Size of the batch that will be sent to the endpoint.
- **Connection Timeout**: Timeout for the connection.
- **Secret Key**: Secret key can be used to secure the webhook connection.

### Webhook
To set up a webhook you can simply use the endpoint URL where you want your alert to be sent. Additionally, you can configure the following parameters:
- **Batch Size**: Size of the batch that will be sent to the endpoint.
- **Connection Timeout**: Timeout for the connection.
- **Secret Key**: Secret key can be used to secure the webhook connection.