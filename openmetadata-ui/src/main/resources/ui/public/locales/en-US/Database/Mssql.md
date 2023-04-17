# Mssql

In this section, we provide guides and references to use the Mssql connector.

# Requirements

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

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

### Scheme $(id="scheme")

SQLAlchemy driver scheme options.

### Username $(id="username")

Username to connect to MSSQL. This user should have privileges to read all the metadata in MsSQL.

### Password $(id="password")

Password to connect to MSSQL.

### Host Port $(id="hostPort")

Host and port of the MSSQL service.
Example: `localhost:1433`

### Database $(id="database")

Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.

### Uri String $(id="uriString")

Connection URI In case of pyodbc

### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
<!-- connectionOptions to be updated -->

### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
<!-- connectionArguments to be updated -->

### Supports Database $(id="supportsDatabase")

The source service supports the database concept in its hierarchy
<!-- supportsDatabase to be updated -->

