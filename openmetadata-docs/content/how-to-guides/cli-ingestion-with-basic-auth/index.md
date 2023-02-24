---
title: How To Run Ingestion Pipeline Via CLI with Basic Auth
slug: /how-to-guides/cli-ingestion-with-basic-auth
---

# How To Run Ingestion Pipeline Via CLI with Basic Auth

Out of the box, OpenMetadata comes with a Username & Password Login Mechanism.

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="10k"
    bold="Basic Authentication"
    href="/deployment/security/basic-auth"
  >
    Basic Authentication
  </InlineCallout>
</InlineCalloutContainer>

<br/>

From `0.12.1` OpenMetadata has changed the default `no-auth` to `Basic` auth, So to run any ingestion pipeline from CLI you will have to pass the `jwtToken` and `authProvider` in the `securityConfig`.
<br/>

## How to get the JWT token

1. Go to the `settings` page from the navbar and then scroll down to the `Integrations` Section. Click on the `Bots` and you will see the list of bots, then click on the `ingestion-bot`.
   <Image src="/images/cli-ingestion-with-basic-auth/bot-list.webp" alt="bot-list"/>
   <br/>
   <br/>

2. You will be redirected to the `ingestion-bot` details page. there you will get the JWT token, click on the copy button and copy the JWT token.
   <Image src="/images/cli-ingestion-with-basic-auth/bot-token.webp" alt="bot-token"/>
   <br/>
   <br/>

Alright, now you have the JWT token, let see how to add that into the workflow config.

## How to add JWT token into the workflow config

Now Past the copied JWT Token into your pipeline `securityConfig`, So your final workflow config will look like this.
<br/>

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
