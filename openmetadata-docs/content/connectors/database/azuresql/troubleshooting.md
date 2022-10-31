---
title: AzureSQL Connector Troubleshooting
slug: /connectors/database/azuresql/troubleshooting
---

# Troubleshooting

Learn how to resolve the most common problems people encounter in the AzureSQL connector.

* ** Unknown error connecting with Engine [...]; An attempt to complete a transaction has failed. No corresponding transaction found. (111214) (SQLEndTran) **

This is an exception you can get when trying to connect to AzureSQL using SQLAlchemy (the internal OpenMetadata Ingestion
library for reaching databases).

To solve this issue, you can edit your Service Connection by adding the following **Connection Argument**:
- Key: `autocommit`
- Value: `true`

<Image src="/images/openmetadata/connectors/database/azuresql/autocommit.png" alt="autocommit"/> 
