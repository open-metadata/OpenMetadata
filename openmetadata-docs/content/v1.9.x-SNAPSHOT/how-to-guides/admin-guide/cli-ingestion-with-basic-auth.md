---
title: How To Run Ingestion Pipeline Via CLI with Basic Auth
slug: /how-to-guides/admin-guide/cli-ingestion-with-basic-auth
---

# How To Run Ingestion Pipeline Via CLI with Basic Auth

Out of the box, OpenMetadata comes with a Username & Password Login Mechanism.
{% inlineCalloutContainer %}

{%inlineCallout icon="10k" bold="Basic Authentication" href="/deployment/security/basic-auth"%}
Basic Authentication
{% /inlineCallout %}

{% /inlineCalloutContainer %}


From `0.12.1` OpenMetadata has changed the default `no-auth` to `Basic` auth, So to run any ingestion pipeline from CLI you will have to pass the `jwtToken` and `authProvider` in the `securityConfig`.

## How to get the JWT token

**1.** Go to the `settings` page from the `activity bar` Section. Click on the `Bots` and you will see the list of bots, then click on the `ingestion-bot`.
   
   {% image
    src="/images/v1.9/cli-ingestion-with-basic-auth/settings-bot.png"
    alt="settings-bot" /%}

   {% image
    src="/images/v1.9/cli-ingestion-with-basic-auth/bot-list.png"
    alt="bot-list" /%}


**2.** You will be redirected to the `ingestion-bot` details page. there you will get the JWT token, click on the copy button and copy the JWT token.
   {% image
src="/images/v1.9/cli-ingestion-with-basic-auth/bot-token.png"
alt="bot-token" /%}


Alright, now you have the JWT token, let see how to add that into the workflow config.

## How to add JWT token into the workflow config

Now Past the copied JWT Token into your pipeline `securityConfig`, So your final workflow config will look like this.


> AuthProvider Should be **openmetadata** i.e authProvider: openmetadata

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: 'eyJraWQiO...'
```

Now you can run the pipeline by running.

```commandline
metadata ingest -c ./pipeline_name.yaml
```
