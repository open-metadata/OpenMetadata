---
title: Connection Details
slug: /connectors/database/clickhouse/connections
---

#### Connection Options

- **Username**: Specify the User to connect to Clickhouse. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Clickhouse.
- **Host and Port**: Enter the fully qualified hostname and port number for your Clickhouse deployment in the Host and Port field.
- **Use HTTPS Protocol**: Enable this flag when the when the Clickhouse instance is hosted via HTTPS protocol. This flag is useful when you are using `clickhouse+http` connection scheme.
- **Secure Connection**: Establish secure connection with ClickHouse. ClickHouse supports secure communication over SSL/TLS to protect data in transit, by checking this option, it establishes secure connection with ClickHouse. This flag is useful when you are using `clickhouse+native` connection scheme.
- **Key File**: The key file path is the location when ClickHouse looks for a file containing the private key needed for secure communication over SSL/TLS. By default, ClickHouse will look for the key file in the `/etc/clickhouse-server directory`, with the file name `server.key`. However, this can be customized in the ClickHouse configuration file (`config.xml`). This flag is useful when you are using `clickhouse+native` connection scheme and the secure connection flag is enabled.

{% partial file="/v1.6/connectors/database/advanced-configuration.md" /%}