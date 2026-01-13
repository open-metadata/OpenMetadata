# SingleStore

In this section, we provide guides and references to use the SingleStore connector. You can view the full documentation for SingleStore <a href="https://docs.open-metadata.org/connectors/database/singlestore" target="_blank">here</a>.

## Requirements
To extract metadata the user used in the connection needs to have access to the `INFORMATION_SCHEMA`. By default, a user can see only the rows in the `INFORMATION_SCHEMA` that correspond to objects for which the user has the proper access privileges.

```SQL
-- Create user.
-- More details <a href="https://docs.singlestore.com/managed-service/en/reference/sql-reference/security-management-commands/create-user.html" target="_blank">https://docs.singlestore.com/managed-service/en/reference/sql-reference/security-management-commands/create-user.html</a>
CREATE USER <username>[@<hostName>] IDENTIFIED BY '<password>';

-- Grant select on a database
GRANT SELECT ON world.* TO '<username>';

-- Grant select on a database
GRANT SELECT ON world.* TO '<username>';

-- Grant select on a specific object
GRANT SELECT ON world.hello TO '<username>';
```

### Profiler & Data Quality
Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

You can find further information on the SingleStore connector in the <a href="https://docs.open-metadata.org/connectors/database/singlestore" target="_blank">docs</a>.

## Connection Details
$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value.
$$

$$section
### Username $(id="username")
Username to connect to SingleStore. This user should have access to the `INFORMATION_SCHEMA` to extract metadata. Other workflows may require different permissions -- refer to the section above for more information.
$$

$$section
### Password $(id="password")
Password to connect to SingleStore.
$$

$$section
### Host Port $(id="hostPort")
This parameter specifies the host and port of the SingleStore instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:3306`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:3306` as the value.
$$

$$section
### Database Name $(id="databaseName")
In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Database > Schema > Table
```
In the case of SingleStore, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
$$

$$section
### Database Schema $(id="databaseSchema")
This is an optional parameter. When set, the value will be used to restrict the metadata reading to a single database (corresponding to the value passed in this field). When left blank, OpenMetadata will scan all the databases.
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$
