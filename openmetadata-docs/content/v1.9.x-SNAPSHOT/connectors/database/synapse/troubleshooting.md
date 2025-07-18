---
title: Synapse Connector Troubleshooting
description: Troubleshoot Synapse connector issues like permission denial, query errors, or slow ingestion.
slug: /connectors/database/synapse/troubleshooting
collate: true
---

{% partial file="/v1.9/connectors/troubleshooting.md" /%}

Learn how to resolve the most common problems people encounter in the Synapse connector.

* **Unknown error connecting with Engine [...]; An attempt to complete a transaction has failed. No corresponding transaction found. (111214) (SQLEndTran)**

This is an exception you can get when trying to connect to Synapse using SQLAlchemy (the internal OpenMetadata Ingestion
library for reaching databases).

To solve this issue, you can edit your Service Connection by adding the following **Connection Argument**:
- Key: `autocommit`
- Value: `true`

{% image
src="/images/v1.9/connectors/synapse/autocommit.webp"
alt="autocommit" /%}


 
* **Cannot open server '[server name]' requested by the login. Client with IP address '[your IP]' is not allowed to access the server**

This is an exception you can get when trying to connect to Synapse using SQLAlchemy (the internal OpenMetadata Ingestion library for reaching databases).


To solve this issue, you need to add your IP address in firewall rules for your Azure SQL instance.

{% image
src="/images/v1.9/connectors/synapse/azure-firewall.webp"
alt="azure sql firewall rules"
caption="azure sql firewall rules" /%}

