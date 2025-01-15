---
title: Connection Details
slug: /connectors/database/oracle/connections
---

#### Connection Details

- **Username**: Specify the User to connect to Oracle. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Oracle.
- **Host and Port**: Enter the fully qualified hostname and port number for your Oracle deployment in the Host and Port field.
- **Database Name**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name. It is recommended to use the database name same as the SID, This ensures accurate results and proper identification of tables during profiling, data quality checks and dbt workflow.
- **Oracle Connection Type** : Select the Oracle Connection Type. The type can either be `Oracle Service Name` or `Database Schema`
  - **Oracle Service Name**: The Oracle Service name is the TNS alias that you give when you remotely connect to your database and this Service name is recorded in tnsnames.
  - **Database Schema**: The name of the database schema available in Oracle that you want to connect with.
- **Oracle instant client directory**: The directory pointing to where the `instantclient` binaries for Oracle are located. In the ingestion Docker image we 
    provide them by default at `/instantclient`. If this parameter is informed (it is by default), we will run the [thick oracle client](https://python-oracledb.readthedocs.io/en/latest/user_guide/initialization.html#initializing-python-oracledb).
    We are shipping the binaries for ARM and AMD architectures from [here](https://www.oracle.com/database/technologies/instant-client/linux-x86-64-downloads.html)
    and [here](https://www.oracle.com/database/technologies/instant-client/linux-arm-aarch64-downloads.html) for the instant client version 19.

{% partial file="/v1.6/connectors/database/advanced-configuration.md" /%}