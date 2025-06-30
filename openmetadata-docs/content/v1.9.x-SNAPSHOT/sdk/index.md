---
title: OpenMetadata SDK | OpenMetadata Software Development Kit
slug: /sdk
---

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

# OpenMetadata API

To access OpenMetadata APIs, one needs a token to authenticate and authorize API calls.

Access the OpenAPI (Swagger) documentation at [OpenMetadata API](https://docs.open-metadata.org/swagger.html).

## How to get the JWT Token

### Bot Token

1. Go to the settings page from the navbar and then scroll down to the Integrations Section. Click on the Bots and you will see the list of bots, then click on the ingestion-bot. {% image src="/images/apis/bots/bots.png" alt="bot-list" /%}

2. You will be redirected to the ingestion-bot details page. there you will get the JWT token, click on the copy button and copy the JWT token. {% image src="/images/apis/bots/bots-token.png" alt="bot-token" /%}

3. Optionally, You can create your own bot for specific use case.


### User Token

1. From 1.3.0 release onwards, we support User's personal access token

2. Go to logged in user profile by clicking on User's profile image on top right corner. {% image src="/images/apis/users/user-profile-page.png" alt="user-profile" /%}

3. Click on Access Token tab, Generate a New token. {% image src="/images/apis/users/user-profile-access-token.png" alt="user-profile" /%}

Alright, now you have the JWT token to use it with the SDKs below.


