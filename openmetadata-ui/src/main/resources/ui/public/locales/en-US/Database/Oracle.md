# Oracle

In this section, we provide guides and references to use the Oracle connector.

## Requirements

$$note
To retrieve metadata from an Oracle database, the `python-oracledb` library is used, which provides support for versions `12c`, `18c`, `19c`, and `21c`.
$$

To ingest metadata from oracle user must have the following permissions:
- `CREATE SESSION` privilege for the user.

```sql
-- CREATE USER
CREATE USER user_name IDENTIFIED BY admin_password;

-- CREATE ROLE
CREATE ROLE new_role;

-- GRANT ROLE TO USER 
GRANT new_role TO user_name;

-- GRANT CREATE SESSION PRIVILEGE TO USER
GRANT CREATE SESSION TO new_role;

-- GRANT SELECT CATALOG ROLE PRIVILEGE TO FETCH METADATA TO ROLE / USER
GRANT SELECT_CATALOG_ROLE TO new_role;
```

- `GRANT SELECT` on the relevant tables which are to be ingested into OpenMetadata to the user
```sql
GRANT SELECT ON table_name TO {user | role};
```

### Profiler & Data Quality
Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. The user should also be allowed to view information in `all_objects` and `all_tables` for all objects in the database. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

### Usage & Lineage
For the usage and lineage workflow, the user will need `SELECT` privilege. You can find more information on the usage workflow <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/usage" target="_blank">here</a> and the lineage workflow <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/lineage" target="_blank">here</a>.

You can find further information on the Oracle connector in the <a href="https://docs.open-metadata.org/connectors/database/oracle" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")

**oracle+cx_oracle**: Sqlalchemy scheme to connect to Oracle.
$$

$$section
### Username $(id="username")

Username to connect to Oracle. This user should have privileges to read all the metadata in Oracle.
$$

$$section
### Password $(id="password")

Password to connect to Oracle.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the Oracle instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:1521`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:1521` as the value.
$$

$$section
### Oracle Connection Type $(id="oracleConnectionType")

Connect with oracle by either passing service name or database schema name.

- **Database Schema**: Using a database schema name when connecting to an Oracle database allows the user to access only the objects within that schema, rather than the entire database.
- **Oracle Service Name**: Oracle Service Name is a unique identifier for a database instance or group of instances that perform a particular function.
- **Oracle TNS Connection**: You can directly use the TNS connection string, e.g., `(DESCRIPTION=(ADDRESS_LIST=(ADDRESS=(PROTOCOL=TCP)(HOST=myhost)(PORT=1530)))(CONNECT_DATA=(SID=MYSERVICENAME)))`.
$$

$$section
### Oracle Service Name $(id="oracleServiceName")

The Oracle Service Name is the TNS alias that you give when you remotely connect to your database and this Service name is recorded in `tnsnames`.
$$

$$section
### Database Schema $(id="databaseSchema")

The name of the Database Schema available in Oracle that you want to connect with.
$$

$$section
### Oracle TNS Connection $(id="oracleTNSConnection")

TNS connection string you would set in `tnsnames.ora`, e.g., `(DESCRIPTION=(ADDRESS_LIST=(ADDRESS=(PROTOCOL=TCP)(HOST=myhost)(PORT=1530)))(CONNECT_DATA=(SID=MYSERVICENAME)))`.

Note that if this is informed, we will ignore the `hostPort` property, so you should make sure that the `HOST` entry is present here.
$$

$$section
### Instant Client Directory $(id="instantClientDirectory")

This directory will be used to set the `LD_LIBRARY_PATH` env variable. It is required if you need to enable thick connection mode. By default, we bring Instant Client 19 and point to `/instantclient`.
$$

$$section
### Database Name $(id="databaseName")
In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Database > Schema > Table
```
In the case of Oracle, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.

**Note:** It is recommended to use the database name same as the SID, This ensures accurate results and proper identification of tables during profiling, data quality checks and dbt workflow.

$$

$$section
### Connection Options $(id="connectionOptions")

Enter the details for any additional connection options that can be sent to Oracle during the connection. These details must be added as Key-Value pairs.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Oracle during the connection. These details must be added as Key-Value pairs.
$$
