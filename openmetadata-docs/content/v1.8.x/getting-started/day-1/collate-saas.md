---
title: Collate SaaS Setup Guide | Connect Database Services for Metadata Extraction
description: Learn how to configure database services in Collate SaaS, allow IP access, test connections, and begin metadata extraction using built-in connectors like Snowflake.
slug: /getting-started/day-1/collate-saas
collate: true
---

## Setting Up a Database Service for Metadata Extraction

You can easily set up a database service for metadata extraction from Collate SaaS in just a few minutes. For example, here’s how to set up a connection using the `Snowflake` Connector:

1. Log in to your Collate SaaS instance, then navigate to **Settings > Services > Databases** & Click on Add New Service.

{% image
  src="/images/v1.8/getting-started/add-service.png"
  alt="Adding Database Service"
  caption="Adding Database Service" /%}

2. **Select the database type** you want to use. Enter details such as the name and description to identify the database. In this Case we are selecting `Snowflake`.

{% image
  src="/images/v1.8/getting-started/select-service.png"
  alt="Selecting Database Service"
  caption="Selecting Database Service" /%}

3. **Enter the Connection Details** You can view the available documentation in the side panel for guidance. Also, refer to the connector [documentation](/connectors).

{% image
  src="/images/v1.8/getting-started/configure-connector.png"
  alt="Updating Connection Details"
  caption="Updating Connection Details" /%}

4. **Allow the Collate SaaS IP**. In the Connection Details, you will see the IP Address unique to your cluster, You need to Allow the `IP` to Access the datasource.


{% note %}
This step is required only for Collate SaaS. If you are using Hybrid SaaS, you will not see the IP address in the Service Connection details.
{% /note %}

{% image
  src="/images/v1.8/getting-started/collate-saas-ip.png"
  alt="Collate SaaS IP"
  caption="Collate SaaS IP" /%}

5. **Test the connection** to verify the status. The test connection will check if the Service is reachable from Collate.

{% image
  src="/images/v1.8/getting-started/test-connection.png"
  alt="Verifying the Test Connection"
  caption="Verifying the Test Connection" /%}

{%inlineCallout
  color="violet-70"
  bold="Explore Hybrid SaaS"
  icon="MdArrowForward"
  href="/getting-started/day-1/hybrid-saas"%}
  You can read more about Hybrid SaaS.
{%/inlineCallout%}