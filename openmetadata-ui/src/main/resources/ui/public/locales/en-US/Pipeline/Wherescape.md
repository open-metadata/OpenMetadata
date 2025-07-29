# Wherescape

In this section, we provide guides and references to use the Wherescape connector.

## Requirements

1. **Wherescape Connector**: which we will configure in this section and requires access to the underlying database.


## Connection Details


$$section
### Metadata Database Connection $(id="connection")

Select your underlying database connection. We support the MSSQL database from Wherescape

$$

## Mssql Connection

In this section, we provide guides and references to use the MSSQL connection.

## Requirements

The user must have `SELECT` privileges to fetch the metadata of tables and views.

```sql
-- Create a new user
-- More details https://learn.microsoft.com/en-us/sql/t-sql/statements/create-user-transact-sql?view=sql-server-ver16
CREATE USER Mary WITH PASSWORD = '********';
-- Grant SELECT on table
GRANT SELECT TO Mary;
```

### Remote Connection

#### 1. SQL Server running

Make sure the SQL server that you are trying to connect is in running state.

#### 2. Allow remote connection on MSSMS (Microsoft SQL Server Management Studio)

This step allow the sql server to accept remote connection request.

![remote-connection](/doc-images/Database/Mssql/remote-connection.png)

#### 3. Configure Windows Firewall 

If you are using SQL server on Windows, you must configure the firewall on the computer running SQL Server to allow access.

1. On the Start menu, select `Run`, type `WF.msc`, and then select `OK`.
2. In the `Windows Firewall with Advanced Security`, in the left pane, right-click` Inbound Rules`, and then select `New Rule` in the action pane.
3. In the `Rule Type` dialog box, select `Port`, and then select `Next`.
4. In the `Protocol and Ports` dialog box, select `TCP`. Select Specific local ports, and then type the port number of the instance of the Database Engine, such as 1433 for the default instance. Select `Next`.
5. In the `Action` dialog box, select `Allow` the connection, and then select Next.
6. In the `Profile` dialog box, select any profiles that describe the computer connection environment when you want to connect to the Database Engine, and then select `Next`.
7. In the `Name` dialog box, type a name and description for this rule, and then select `Finish`.

For details step please refer this [link](https://docs.microsoft.com/en-us/sql/database-engine/configure-windows/configure-a-windows-firewall-for-database-engine-access?view=sql-server-ver15).

You can find further information on the MSSQL connector in the [docs](https://docs.open-metadata.org/connectors/database/mssql).

## Connection Details

$$section
### Scheme $(id="scheme")
There are three schemes based on the user's requirement to fetch data from MSSQL:
- **mssql+pytds**: High-performance open-source library for connecting to Microsoft SQL Server.
- **mssql+pyodbc**: Cross-platform Python library that uses ODBC to connect to Microsoft SQL Server.
- **mssql+pymssql**: Python library that uses FreeTDS to connect to Microsoft SQL Server, with support for bulk data transfer and query timeouts.

If you are connecting via windows authentication from a linux docker deployment please use `mssql+pymssql`. 

$$

$$section
### Username $(id="username")

Username to connect to MSSQL. This user should have privileges to read all the metadata in MSSQL.
$$

$$section
### Password $(id="password")

Password to connect to MSSQL.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the MSSQL instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:1433`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:1433` as the value.
$$

$$section
### Database $(id="database")

Provide the name of the database which contains Wherescape tables.
$$

$$section
### Driver $(id="driver")

Connecting to MSSQL via **pyodbc** scheme requires the ODBC driver to be installed. Specify ODBC driver name in the field.

You can download the ODBC driver from [here](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server?view=sql-server-ver16).

In case of Docker or Kubernetes deployments, this driver comes out of the box with version `ODBC Driver 18 for SQL Server`.
$$


$$section
### Ingest All Databases $(id="ingestAllDatabases")
Not applicable for Wherescape
$$


$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Enter the details for any additional connection arguments such as security or protocol configs that can be sent to MSSQL during the connection. These details must be added as Key-Value pairs.

When Connecting to MSSQL via **pyodbc** scheme requires the Connection Arguments Encrypt: No and TrustServerCertificate: Yes.
$$
