# Vertica

In this section, we provide guides and references to use the Vertica connector.

## Requirements

To run the Metadata ingestion we need a user with `SELECT` grants on the schemas that you'd like to ingest, as well as to the `V_CATALOG` schema. You can grant those as follows for the schemas in your database:

```sql
CREATE USER openmetadata IDENTIFIED BY 'password';
GRANT SELECT ON ALL TABLES IN SCHEMA PUBLIC TO openmetadata;
GRANT SELECT ON ALL TABLES IN SCHEMA V_CATALOG TO openmetadata;
```

Note that these `GRANT`s won't be applied to any new table created on the schema unless the schema has <a href="https://www.vertica.com/docs/8.1.x/HTML/index.htm#Authoring/AdministratorsGuide/Security/DBUsersAndPrivileges/GrantInheritedPrivileges.htm" target="_blank">Inherited Privileges</a>.

```sql
ALTER SCHEMA s1 DEFAULT INCLUDE PRIVILEGES;
-- If using the PUBLIC schema
ALTER SCHEMA "<db>.public" DEFAULT INCLUDE PRIVILEGES;
```

### Usage & Lineage

If you also want to run the Lineage and Usage workflows, then the user needs to be granted permissions to the `V_MONITOR` schema:

```sql
GRANT SELECT ON ALL TABLES IN SCHEMA V_MONITOR TO openmetadata;
```

Note that this setting might only grant visibility to the queries executed by this user. 
A more complete approach will be to grant the `SYSMONITOR` role to the `openmetadata` user:

```sql
GRANT SYSMONITOR TO openmetadata;
ALTER USER openmetadata DEFAULT ROLE SYSMONITOR;
```

### Profiler & Data Quality

To run the profiler, it's not enough to have `USAGE` permissions to the schema as we need to `SELECT` the tables in there. Therefore, you'll need to grant `SELECT` on all tables for the schemas:

```sql
GRANT SELECT ON ALL TABLES IN SCHEMA <schema> TO openmetadata;
```

You can find further information on the Vertica connector in the <a href="https://docs.open-metadata.org/connectors/database/vertica" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")

Driver to connect to Vertica.
$$

$$section
### Username $(id="username")

Username to connect to Vertica. You can follow the steps above to have a user created with all the necessary permissions.

$$

$$section
### Password $(id="password")

Password to connect to Vertica.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the Vertica instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:5433`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:5433` as the value.
$$

$$section
### Database $(id="database")

Database of the data source. This is an optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, the OpenMetadata Ingestion attempts to scan all the databases.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$
