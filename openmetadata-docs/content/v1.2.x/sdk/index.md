---
title: OpenMetadata SDK
slug: /sdk
---

# OpenMetadata API

To access OpenMetadata APIs, one needs a token to authenticate and authorize API calls.

## How to get the JWT Token

### Bot Token

1. Go to the settings page from the navbar and then scroll down to the Integrations Section. Click on the Bots and you will see the list of bots, then click on the ingestion-bot. {% image src="/images/v1.2/cli-ingestion-with-basic-auth/bot-list.png" alt="bot-list"  /%}

2. You will be redirected to the ingestion-bot details page. there you will get the JWT token, click on the copy button and copy the JWT token. {% image src="/images/v1.2/cli-ingestion-with-basic-auth/bot-token.png" alt="bot-token"  /%}

3. Optionally, You can create your own bot for specific use case.

Alright, now you have the JWT token, let see how to add that into the workflow config.




# OpenMetadata SDK

Here are the articles in this section:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="play_arrow"
    bold="Python SDK"
    href="/sdk/python" %}
    Presentation of a high-level Python API as a type-safe and gentle wrapper for the OpenMetadata backend.
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="play_arrow"
    bold="Java SDK"
    href="/sdk/java" %}
    Provision, manage, and use OpenMetadata resources directly from your Java applications.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}