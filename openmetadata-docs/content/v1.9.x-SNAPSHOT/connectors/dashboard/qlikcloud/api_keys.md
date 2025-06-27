---
title: Qlik Cloud
slug: /connectors/dashboard/qlikcloud/api_keys
---

# How to generate API Key

OpenMetadata Uses [REST APIs](https://qlik.dev/apis/) to communicate with Qlik Cloud and fetch relevant metadata, and connecting to these APIs require authentication token as described in [these docs](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/mc-generate-api-keys.htm).


In this document we will explain how you can generate this token so that OpenMetadata can communicate with Qlik Cloud.


# Step 1: Open Qlik Cloud Management Console (QMC)

Open your Qlik Cloud Management Console (QMC) and navigate to API Keys section.

{% image
  src="/images/v1.9/connectors/qlikcloud/qlik-cloud-management-console.png"
  alt="Navigate to API Keys in QMC"
  caption="Navigate to API Keys in QMC"
 /%}

# Step 2: Provide Name and Generate API Key

1. Provide name for the API key you will generate.

2. Select Expire in time. It will revoke the API in selected time duration.

3. Click On Generate. Copy the key and keep it somewhere safe.

Note: This Key will be generated only once. So remember to keep it in secure location.

{% image
  src="/images/v1.9/connectors/qlikcloud/qlik-cloud-generate-new-api-key.png"
  alt="Provide API Key Details"
  caption="Provide API Key Details"
 /%}
