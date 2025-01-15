---
title: Connection Details
slug: /connectors/database/teradata/connections
---

#### Connection Details

- **Username**: Specify the User to connect to Teradata.
- **Password**: Password to connect to Teradata
- **Logmech**: Specifies the logon authentication method. Possible values are TD2 (the default), JWT, LDAP, KRB5 for Kerberos, or TDNEGO.  
- **LOGDATA**: Specifies additional data needed by a logon mechanism, such as a secure token, Distinguished Name, or a domain/realm name. LOGDATA values are specific to each logon mechanism.
- **Host and Port**: Enter the fully qualified hostname and port number (default port for Teradata is 1025) for your Teradata deployment in the Host and Port field.
- **Transaction Mode**: Specifies the transaction mode for the connection. Possible values are DEFAULT (the default), ANSI, or TERA.
- **Teradata Database Account**: Specifies an account string to override the default account string defined for the database user. Accounts are used by the database for workload management and resource usage monitoring.
- **Connection Options** and **Connection Arguments**: additional connection parameters. For more information please view teradatasql [docs](https://pypi.org/project/teradatasql/).

{% partial file="/v1.6/connectors/database/advanced-configuration.md" /%}