# AzureSQL

In this section, we provide guides and references to use the AzureSQL connector.

## Requirements

Make sure if you have whitelisted the ingestion IP on Azure SQL firewall rules. Checkout <a href="https://learn.microsoft.com/en-us/azure/azure-sql/database/firewall-configure?view=azuresql#use-the-azure-portal-to-manage-server-level-ip-firewall-rules" target="_blank">this</a> document on how to whitelist your IP using the Azure portal.

AzureSQL database user must grant `SELECT` privilege to fetch the metadata of tables and views.

```sql
-- Create a new user
-- More details https://learn.microsoft.com/en-us/sql/t-sql/statements/create-user-transact-sql?view=sql-server-ver16
CREATE USER Mary WITH PASSWORD = '********';
-- Grant SELECT on table
GRANT SELECT TO Mary;
```

You can find further information on the Azure connector in the <a href="https://docs.open-metadata.org/connectors/database/azuresql" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Username $(id="username")

Username to connect to AzureSQL. This user should have privileges to read the metadata.
$$

$$section
### Password $(id="password")

Password to connect to AzureSQL.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the AzureSQL instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `azure-sql-service-name.database.windows.net:1433`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:3000` as the value.
$$

$$section
### Database $(id="database")

Database of the data source. This is an optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, the OpenMetadata Ingestion attempts to scan all the databases.
$$

$$section
### Driver $(id="driver")

Connecting to AzureSQL requires the ODBC driver to be installed. Specify ODBC driver name in the field.

You can download the ODBC driver from <a href="https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server?view=sql-server-ver16" target="_blank">here</a>.

In case of Docker or Kubernetes deployments, this driver comes out of the box with version `ODBC Driver 18 for SQL Server`.

$$

**Authentication Mode**:

$$section
### Authentication $(id="authentication")
   - The `authentication` parameter determines the method of authentication when connecting to AzureSQL using ODBC (Open Database Connectivity).
   - If you select **"Active Directory Password"**, you'll need to provide the password associated with your Azure Active Directory account.
   - Alternatively, if you choose **"Active Directory Integrated"**, the connection will use the credentials of the currently logged-in user. This mode ensures secure and seamless connections with AzureSQL.
$$

$$section
### Encrypt $(id="encrypt")
   - The `encrypt` setting in the connection string pertains to data encryption during communication with AzureSQL.
   - When enabled, it ensures that data exchanged between your application and the database is encrypted, enhancing security.
$$

$$section

### Trust Server Certificate $(id="trustServerCertificate"):
   - The `trustServerCertificate` option also relates to security.
   - When set to true, your application will trust the server's SSL certificate without validation. Use this cautiously, as it bypasses certificate validation checks.
$$

$$section
### Connection Timeout $(id="connectionTimeout"):
   - The `connectionTimeout` parameter specifies the maximum time (in seconds) that your application will wait while attempting to establish a connection to AzureSQL.
   - If the connection cannot be established within this timeframe, an error will be raised.
$$

$$section
### Ingest All Databases $(id="ingestAllDatabases")
If ticked, the workflow will be able to ingest all database in the cluster. If not ticked, the workflow will only ingest tables from the database set above.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$
