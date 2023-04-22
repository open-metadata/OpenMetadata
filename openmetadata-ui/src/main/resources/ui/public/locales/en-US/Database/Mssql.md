# Mssql

In this section, we provide guides and references to use the Mssql connector.

## Requirements

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

MSSQL User must grant `SELECT` privilege to fetch the metadata of tables and views.

```sql
-- Create a new user
-- More details https://learn.microsoft.com/en-us/sql/t-sql/statements/create-user-transact-sql?view=sql-server-ver16
CREATE USER Mary WITH PASSWORD = '********';
-- Grant SELECT on table
GRANT SELECT TO Mary;
```

### Profiler & Data Quality
Executing the profiler worflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](https://docs.open-metadata.org/connectors/ingestion/workflows/profiler) and data quality tests [here](https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality).

### Usage & Lineage
For the usage and lineage workflow, the user will need `SELECT` privilege table. You can find more information on the usage workflow [here](https://docs.open-metadata.org/connectors/ingestion/workflows/usage) and the lineage workflow [here](https://docs.open-metadata.org/connectors/ingestion/workflows/lineage).

### For Remote Connection

#### 1. SQL Server running

Make sure the SQL server that you are trying to connect is in running state.

#### 2. Allow remote connection on MSSMS(Microsoft SQL Server Management Studio)

This step allow the sql server to accept remote connection request.

![remote-connection](/doc-images/Database/Mssql/remote-connection.png)

#### 3. Configure Windows Firewall 

If you are using SQL server on windows, you must configure the firewall on the computer running SQL Server to allow access.

- Step 1: On the Start menu, select Run, type WF.msc, and then select OK.

Step 2: In the Windows Firewall with Advanced Security, in the left pane, right-click Inbound Rules, and then select New Rule in the action pane.

Step 3: In the Rule Type dialog box, select Port, and then select Next.

Step 4: In the Protocol and Ports dialog box, select TCP. Select Specific local ports, and then type the port number of the instance of the Database Engine, such as 1433 for the default instance. Select Next.

Step 5: In the Action dialog box, select Allow the connection, and then select Next.

Step 6: In the Profile dialog box, select any profiles that describe the computer connection environment when you want to connect to the Database Engine, and then select Next.

Step 7: In the Name dialog box, type a name and description for this rule, and then select Finish.

For details step please refer the this [link](https://docs.microsoft.com/en-us/sql/database-engine/configure-windows/configure-a-windows-firewall-for-database-engine-access?view=sql-server-ver15).

## Connection Details

$$section
### Scheme $(id="scheme")
There are three schemes based on the user's requirement to fetch data from MSSQL:
- **mssql+pytds**: High-performance open-source library for connecting to Microsoft SQL Server.
- **mssql+pyodbc**: Cross-platform Python library that uses ODBC to connect to Microsoft SQL Server.
- *mssql+pymssql**: Python library that uses FreeTDS to connect to Microsoft SQL Server, with support for bulk data transfer and query timeouts.
$$

$$section
### Username $(id="username")

Username to connect to MSSQL.
This user should have privileges to read all the metadata in MSSQL.
$$

$$section
### Password $(id="password")

Password to connect to MSSQL.
$$

$$section
### Host Port $(id="hostPort")

The hostPort parameter specifies the host and port of the MSSQL instance. This should be specified as a string in the format `http://hostname:port` or `https://hostname:port`. For example, you might set the hostPort parameter to `https://:3000`.
$$

$$section
### Database $(id="database")

Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
$$

$$section
### Uri String $(id="uriString")

Connection URI String to connect with MSSQL. It only works with `pyodbc` scheme.
Example: `DRIVER={ODBC Driver 17 for SQL Server};SERVER=server_name;DATABASE=db_name;UID=user_name;PWD=password`.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Enter the details for any additional connection arguments such as security or protocol configs that can be sent to MSSQL during the connection. These details must be added as Key-Value pairs.
- In case you are using Single-Sign-On (SSO) for authentication, add the authenticator details in the Connection Arguments as a Key-Value pair as follows: "authenticator" : "sso_login_url".
- In case you authenticate with SSO using an external browser popup, then add the authenticator details in the Connection Arguments as a Key-Value pair as follows: "authenticator" : "externalbrowser".
$$