---
title: Alerts & Notifications
slug: /openmetadata/alerts-notifications
---

# Alerts & Notifications
Starting in 0.13 OpenMetadata allows users to define fine grain notification/alerts using the "Alerts" feature. This feature replaces the Webhook that present in version 0.12 and before. It stills provides native integration with Slack and MS Webhook and give you the ability to send alerts using a generic webhook. It also introduces the ability to send email alerts

## Creating an Alert
### Step 1
Navigate to `settings > Alerts.

Once on the alert page click on the purple button `Create alert` in the top right corner.

### Step 2
Configure you alert.

As with most configuration in OpenMetadata you will first need to add a Name and a Description for your alert. Once this is completed, we can move on to the configuration. You have 3 steps to configure your alert:
1. **Trigger**: this will determine how your alert should be trigger. You can select your alert to be triggered when events happen against all the existing assets or only specific ones
2. **Filter**: in this section, you can add specific event filters. The filter input will determine what event will trigger an alert to be sent. Setting `Allow` against a condition will result in an alert being sent if the condition is met while setting `Deny` will silence this condition (i.e. alert won't be sent for the denied event).
3. **Destination**: you will determine where your alert should be sent in this section. We provide 4 destinations
    - Slack
    - MS Teams
    - Email
    - Webhook

<Image
    src="/images/openmetadata/alerts-notifications/OMAlerts.gif"
    alt="Set profiler configuration"
    caption="Configure OpenMetadata Alert"
/>

## Configuration Details for Destinations
### Slack
For slack configuration you will need to get the endpoint URL of the channel where you wish to send the alerts. Additionally, you can conigure the following parameter:
- **Batch Size**: size of the batch that will be sent to the endpoint.
- **Connection Timeout**: timeout for the connection.
- **Secret Key**: Secret key can be used to secure the webhook connection.

### MS Teams
For MS Teams configuration you will need to get the endpoint URL if the chanel where you wish to send the alerts. You can find this by going to the Teams channel where you want the posts to appear, clicking the three dots `...`, and clicking "Connectors".  Then add the "Incoming Webhook" connector.  Copy this connector's URL and supply it here to OpenMetadata.  It may be in the form of `https://your-domain.webhook.office.com/webhookb2/...@.../IncomingWebhook/.../...`.  For more on MS Teams webhooks, see [Create an Incoming Webhook](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook). Additionally, you can conigure the following parameter:
- **Batch Size**: size of the batch that will be sent to the endpoint.
- **Connection Timeout**: timeout for the connection.
- **Secret Key**: Secret key can be used to secure the webhook connection.

### Email
To enable email alerts you will need to make sure you have an SMTP server available. With the information for your SMTP server you can  configure OpenMetadata to send email alerts by updating the below section of the `openmetadata.yaml` file.

```
email:
  emailingEntity: ${OM_EMAIL_ENTITY:-"OpenMetadata"} -> Company Name (Optional)
  supportUrl: ${OM_SUPPORT_URL:-"https://slack.open-metadata.org"} -> SupportUrl (Optional)
  enableSmtpServer : ${AUTHORIZER_ENABLE_SMTP:-false} -> True/False
  openMetadataUrl: ${OPENMETADATA_SERVER_URL:-""} -> {http/https}://{your_domain}
  senderMail: ${OPENMETADATA_SMTP_SENDER_MAIL}
  serverEndpoint: ${SMTP_SERVER_ENDPOINT:-""} -> (Ex :- smtp.gmail.com)
  serverPort: ${SMTP_SERVER_PORT:-""} -> (SSL/TLS port)
  username: ${SMTP_SERVER_USERNAME:-""} -> (SMTP Server Username)
  password: ${SMTP_SERVER_PWD:-""} -> (SMTP Server Password)
  transportationStrategy: ${SMTP_SERVER_STRATEGY:-"SMTP_TLS"}
```

### Webhook
To set up a webhook you can simply use the endpoint URL where you want your alert to be sent. Additionally, you can conigure the following parameter:
- **Batch Size**: size of the batch that will be sent to the endpoint.
- **Connection Timeout**: timeout for the connection.
- **Secret Key**: Secret key can be used to secure the webhook connection.