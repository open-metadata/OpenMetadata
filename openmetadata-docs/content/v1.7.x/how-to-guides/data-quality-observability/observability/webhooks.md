---
title: Webhooks
slug: /how-to-guides/data-quality-observability/observability/webhooks
---

{% note %}

# Webhooks

In 0.13.1 , webhooks have been deprecated. You should instead use [OpenMetadata alerts](/how-to-guides/admin-guide/alerts)

Before upgrading to 0.13.1 it is recommended to save the existing Webhook configs(like webhook url) to use them later.

We have added Alerts/Notifications , which can be configured to receive customised alerts on updates in OM using Triggers, Filtering Information to different destinations like Slack, MsTeams or even Emails.
Please use the same webhook config that you had saved from previous version to configure the Alerts Destination after upgrading.

{% /note %}

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
3. **Destination**: Enter the Consumer/client URL to consume the event's data.
4. **Source**: Can be used to activate or disable the webhook.
5. **Filters**: Filters are provided for all the entities and for all the events.
   Event data for specific action can be achieved.

{% image
src="/images/v1.7/how-to-guides/observability/webhook.png"
alt="Generic Webhook"
caption="Generic Webhook"
/%}

## How to Set up Slack Type Webhook:
1. **Name**: Add the name of the webhook
2. **Description**: Describe the webhook.
3. **Destination**: Enter the Slack endpoint URL.
4. **Source**: Can be used to activate or disable the webhook.
5. **Filters**: Filters are provided for all the entities and for all the events.
   Event data for specific action can be achieved.


{% image
src="/images/v1.7/how-to-guides/observability/slack.png"
alt="Slack Webhook"
caption="Slack Webhook"
/%}

## How to Set up Microsoft Teams Type Webhook:
1. **Name**: Add the name of the webhook
2. **Description**: Describe the webhook.
3. **Destination**: Enter the MS Teams endpoint URL.  You can find this by going to the Teams channel where you want the posts to appear, clicking the three dots `...`, and clicking "Connectors".  Then add the "Incoming Webhook" connector.  Copy this connector's URL and supply it here to OpenMetadata.  It may be in the form of `https://your-domain.webhook.office.com/webhookb2/...@.../IncomingWebhook/.../...`.  For more on MS Teams webhooks, see [Create an Incoming Webhook](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook).
4. **Source**: Can be used to activate or disable the webhook.
5. **Filters**: Filters are provided for all the entities and for all the events.
   Event data for specific action can be achieved.

{% image
src="/images/v1.7/how-to-guides/observability/msteam.png"
alt="MS Team Webhook"
caption="MS Team Webhook"
/%} 

## How to Set up Google Chat Type Webhook:
1. **Name**: Add the name of the webhook
2. **Description**: Describe the webhook.
3. **Destination**: Enter the GChat endpoint URL.  For more on creating GChat webhooks, see [Create a Webhook](https://developers.google.com/chat/how-tos/webhooks#create_a_webhook).
4. **Source**: Can be used to activate or disable the webhook.
5. **Filters**: Filters are provided for all the entities and for all the events.
   Event data for specific action can be achieved.

{% image
src="/images/v1.7/how-to-guides/observability/gchat.png"
alt="Gchat Webhook"
caption="Gchat Webhook"
/%} 