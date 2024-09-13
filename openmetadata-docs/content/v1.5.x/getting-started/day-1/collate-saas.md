---
title: Collate SaaS
slug: /getting-started/day-1/collate-saas
collate: true
---

## Setting Up a Database Service for Metadata Extraction

You can easily set up a database service for metadata extraction from Collate SaaS in just a few minutes. For example, here’s how to set up a connection using the `Snowflake` Connector:

1. Log in to your Collate SaaS instance, then navigate to **Settings > Services > Databases** & Click on Add New Service.

{% image
  src="/images/v1.5/getting-started/add-service.png"
  alt="Adding Database Service"
  height="500px"
  caption="Adding Database Service" /%}

2. **Select the database type** you want to use. Enter details such as the name and description to identify the database. In this Case we are selecting `Snowflake`.

{% image
  src="/images/v1.5/getting-started/select-service.png"
  alt="Selecting Database Service"
  height="850px"
  caption="Selecting Database Service" /%}

4. **Enter the Connection Details** You can view the available documentation in the side panel for guidance. Also, refer to the connector [documentation](/connectors).

{% image
  src="/images/v1.5/getting-started/configure-connector.png"
  alt="Updating Connection Details"
  height="950px"
  caption="Updating Connection Details" /%}

5. **Allow the Collate SaaS IP**. In the Connection Details, you will see the IP Address unique to your cluster, You need to Allow the `IP` to Access the datasource.


{% note %}
This step is required only for Collate SaaS. If you are using Hybrid SaaS, you will not see the IP address in the Service Connection details.
{% /note %}

{% image
  src="/images/v1.5/getting-started/collate-saas-ip.png"
  alt="Collate SaaS IP"
  height="200px"
  caption="Collate SaaS IP" /%}

6. **Test the connection** to verify the status. The test connection will check if the Service is reachable from Collate.

{% image
  src="/images/v1.5/getting-started/test-connection.png"
  alt="Verifying the Test Connection"
  height="350px"
  caption="Verifying the Test Connection" /%}