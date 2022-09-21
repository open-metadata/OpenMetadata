---
title: Webhooks
slug: /developers/webhooks
---

# Webhooks

A webhook is a way for an app to provide other applications with real-time information.
A webhook delivers data to other applications as it happens, meaning you get data immediately.
OpenMetadata out of the box provide support for Webhooks.
Webhooks can be used to get real-time information for the application when an event occurs.
OpenMetadata also allows the user to customise the webhook with a wide range of filters to listen to only selected type of events


## OpenMetadata supports 3 webhook types:
1. **Generic**
2. **Slack**
3. **Microsoft Teams**

## How to Set up Generic Type Webhook:
1. **Name**: Add the name of the webhook
2. **Description**: Add description of the webhook/Describe the webhook.
3. **Endpoint URL**: Enter the Consumer/client URL to consume the event's data.
4. **Activity Filter**: Can be used to activate or disable the webhook.
5. **Event Filters**: Filters are provided for all the entities and for all the events.
   Event data for specific action can be achieved.
6. **Batch Size**: Enter the batch size.
7. **Connection Timeout**: Enter the desired connection timeout.
8. **Secret Key**: Secret key can be used to secure the webhook connection.

![webhook-generic](https://user-images.githubusercontent.com/83201188/188461969-7f318869-4048-4625-a896-da88bce811c2.png)

## How to Set up Slack Type Webhook:
1. **Name**: Add the name of the webhook
2. **Description**: Add description of the webhook/Describe the webhook.
3. **Endpoint URL**: Enter the Slack endpoint url.
4. **Activity Filter**: Can be used to activate or disable the webhook.
5. **Event Filters**: Filters are provided for all the entities and for all the events.
   Event data for specific action can be achieved.
6. **Batch Size**: Enter the batch size.
7. **Connection Timeout**: Enter the desired connection timeout.
8. **Secret Key**: Secret key can be used to secure the webhook connection.

![webhook-slack](https://user-images.githubusercontent.com/83201188/188462920-2028f777-af0e-4868-b4d2-01e45f520a25.png)

## How to Set up Microsoft Teams Type Webhook:
1. **Name**: Add the name of the webhook
2. **Description**: Add description of the webhook/Describe the webhook.
3. **Endpoint URL**: Enter the MS Teams endpoint url.
4. **Activity Filter**: Can be used to activate or disable the webhook.
5. **Event Filters**: Filters are provided for all the entities and for all the events.
   Event data for specific action can be achieved.
6. **Batch Size**: Enter the batch size.
7. **Connection Timeout**: Enter the desired connection timeout.
8. **Secret Key**: Secret key can be used to secure the webhook connection.

![webhook-msteams](https://user-images.githubusercontent.com/83201188/188462667-bd8443ce-a07d-4742-ae5d-42da3fc2d402.png)  