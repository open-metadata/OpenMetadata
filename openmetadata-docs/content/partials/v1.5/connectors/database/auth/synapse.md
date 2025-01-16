#### Connection Options

- **Username**: Specify the User to connect to Synapse. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Synapse.
- **Host and Port**: Enter the fully qualified hostname and port number for your Synapse deployment in the Host and Port field.
- **Database**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
- **Driver**: Connecting to Synapse requires ODBC driver to be installed. Specify ODBC driver name in the field.
You can download the ODBC driver from [here](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server?view=sql-server-ver16). In case of docker or kubernetes deployment this driver comes out of the box with version  `ODBC Driver 18 for SQL Server`.

**Authentication Mode**:

- **Authentication**:
   - The `authentication` parameter determines the method of authentication when connecting to Synapse using ODBC (Open Database Connectivity).
   - If you select **"Active Directory Password"**, you'll need to provide the password associated with your Azure Active Directory account.
   - Alternatively, if you choose **"Active Directory Integrated"**, the connection will use the credentials of the currently logged-in user. This mode ensures secure and seamless connections with Synapse.

- **Encrypt**:
   - The `encrypt` setting in the connection string pertains to data encryption during communication with Synapse.
   - When enabled, it ensures that data exchanged between your application and the database is encrypted, enhancing security.

- **Trust Server Certificate**:
   - The `trustServerCertificate` option also relates to security.
   - When set to true, your application will trust the server's SSL certificate without validation. Use this cautiously, as it bypasses certificate validation checks.

- **Connection Timeout**:
   - The `connectionTimeout` parameter specifies the maximum time (in seconds) that your application will wait while attempting to establish a connection to Synapse.
   - If the connection cannot be established within this timeframe, an error will be raised.