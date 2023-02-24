---
title: Webhooks
slug: /developers/webhooks
---

<Note>

# Webhooks

In 0.13.1 , webhooks have been deprecated. You should instead use [OpenMetadata alerts](/openmetadata/alerts-notifications)

Before upgrading to 0.13.1 it is recommended to save the existing Webhook configs(like webhook url) to use them later.

We have added Alerts/Notifications , which can be configured to receive customised alerts on updates in OM using Triggers, Filtering Information to different destinations like Slack, MsTeams or even Emails.
Please use the same webhook config that you had saved from previous version to configure the Alerts Destination after upgrading.

</Note>

# Webhooks

A webhook is a way for an app to provide other applications with real-time information.
A webhook delivers data to other applications as it happens, meaning you get data immediately.
OpenMetadata provides out-of-the-box support for webhooks.
OpenMetadata also allows the user to customise the webhook with a wide range of filters to listen to only selected type of events.


## OpenMetadata supports 4 webhook types:
1. **Generic**
2. **Slack**
3. **Microsoft Teams**
4. **Google Chat**

## How to Set up Generic Type Webhook:
1. **Name**: Add the name of the webhook
2. **Description**: Describe the webhook.
3. **Endpoint URL**: Enter the Consumer/client URL to consume the event's data.
4. **Activity Filter**: Can be used to activate or disable the webhook.
5. **Event Filters**: Filters are provided for all the entities and for all the events.
   Event data for specific action can be achieved.
6. **Batch Size**: Enter the batch size.
7. **Connection Timeout**: Enter the desired connection timeout.
8. **Secret Key**: Secret key can be used to secure the webhook connection.

![webhook-generic](https://user-images.githubusercontent.com/83201188/188461969-7f318869-4048-4625-a896-da88bce811c2.webp)

## How to Set up Slack Type Webhook:
1. **Name**: Add the name of the webhook
2. **Description**: Describe the webhook.
3. **Endpoint URL**: Enter the Slack endpoint URL.
4. **Activity Filter**: Can be used to activate or disable the webhook.
5. **Event Filters**: Filters are provided for all the entities and for all the events.
   Event data for specific action can be achieved.
6. **Batch Size**: Enter the batch size.
7. **Connection Timeout**: Enter the desired connection timeout.
8. **Secret Key**: Secret key can be used to secure the webhook connection.

![webhook-slack](https://user-images.githubusercontent.com/83201188/188462920-2028f777-af0e-4868-b4d2-01e45f520a25.webp)

## How to Set up Microsoft Teams Type Webhook:
1. **Name**: Add the name of the webhook
2. **Description**: Describe the webhook.
3. **Endpoint URL**: Enter the MS Teams endpoint URL.  You can find this by going to the Teams channel where you want the posts to appear, clicking the three dots `...`, and clicking "Connectors".  Then add the "Incoming Webhook" connector.  Copy this connector's URL and supply it here to OpenMetadata.  It may be in the form of `https://your-domain.webhook.office.com/webhookb2/...@.../IncomingWebhook/.../...`.  For more on MS Teams webhooks, see [Create an Incoming Webhook](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook).
4. **Activity Filter**: Can be used to activate or disable the webhook.
5. **Event Filters**: Filters are provided for all the entities and for all the events.
   Event data for specific action can be achieved.
6. **Batch Size**: Enter the batch size.
7. **Connection Timeout**: Enter the desired connection timeout.
8. **Secret Key**: Secret key can be used to secure the webhook connection.

![webhook-msteams](https://user-images.githubusercontent.com/83201188/188462667-bd8443ce-a07d-4742-ae5d-42da3fc2d402.webp)  

## How to Set up Google Chat Type Webhook:
1. **Name**: Add the name of the webhook
2. **Description**: Describe the webhook.
3. **Endpoint URL**: Enter the GChat endpoint URL.  For more on creating GChat webhooks, see [Create a Webhook](https://developers.google.com/chat/how-tos/webhooks#create_a_webhook).
4. **Activity Filter**: Can be used to activate or disable the webhook.
5. **Event Filters**: Filters are provided for all the entities and for all the events.
   Event data for specific action can be achieved.
6. **Batch Size**: Enter the batch size.
7. **Connection Timeout**: Enter the desired connection timeout.
8. **Secret Key**: Secret key can be used to secure the webhook connection.