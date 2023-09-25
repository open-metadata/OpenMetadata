# AzureSQL

In this section, we provide guides and references to use the AzureSQL connector.

## Requirements

Make sure if you have whitelisted the ingestion IP on Azure SQL firewall rules. Checkout [this](https://learn.microsoft.com/en-us/azure/azure-sql/database/firewall-configure?view=azuresql#use-the-azure-portal-to-manage-server-level-ip-firewall-rules) document on how to whitelist your IP using the Azure portal.

AzureSQL database user must grant `SELECT` privilege to fetch the metadata of tables and views.

```sql
-- Create a new user
-- More details https://learn.microsoft.com/en-us/sql/t-sql/statements/create-user-transact-sql?view=sql-server-ver16
CREATE USER Mary WITH PASSWORD = '********';
-- Grant SELECT on table
GRANT SELECT TO Mary;
```

You can find further information on the Azure connector in the [docs](https://docs.open-metadata.org/connectors/database/azuresql).

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

You can download the ODBC driver from [here](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server?view=sql-server-ver16).

In case of Docker or Kubernetes deployments, this driver comes out of the box with version `ODBC Driver 18 for SQL Server`.

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
