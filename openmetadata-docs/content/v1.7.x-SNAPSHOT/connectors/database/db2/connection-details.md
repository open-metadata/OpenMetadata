---
title: Connection Details
slug: /connectors/database/db2/connections
---

#### Connection Details

- **Username**: Specify the User to connect to DB2. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to DB2.
- **database**: Database of the data source.
- **Host and Port**: Enter the fully qualified hostname and port number for your DB2 deployment in the Host and Port field.
- **License File Name**: License file name in case the license is required for connection.
- **License**: Contents of your license file if applicable, make sure to replace new lines with `\n` before pasting it here.

{% note %}
If you are using DB2 for IBM i:

- From advanced config you need to chose `ibmi` scheme
- In Host and Port you should not add the Port Number.
{% /note %}

{% partial file="/v1.6/connectors/database/advanced-configuration.md" /%}