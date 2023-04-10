# Redshift

In this section, we provide guides and references to use the Redshift connector.

# Requirements
Redshift user must grant `SELECT` privilege on `SVV_TABLE_INFO` to fetch the metadata of tables and views.

```sql
CREATE USER test_user with PASSWORD 'password';
GRANT SELECT ON TABLE svv_table_info to test_user;
```

If you plan on running the profiler and quality tests you need to make sure your user has `SELECT` privilege on the tables you wish to run those workflows against.  For more information visit [here](https://docs.aws.amazon.com/redshift/latest/dg/c_visibility-of-data.html).

You can find further information on the Redshift connector in the [docs](https://docs.open-metadata.org/connectors/database/redshift).

## Connection Details

### Scheme $(id="scheme")

SQLAlchemy driver scheme options

### Username $(id="username")

Username to connect to Redshift. This user should have privileges to read all the metadata in Redshift.

### Password $(id="password")

Password to connect to Redshift.

### Host Port $(id="hostPort")

Host and port of the Redshift service.

### Database $(id="database")

Initial Redshift database to connect to. If you want to ingest all databases, set `ingestAllDatabases` to true.

### Ingest All Databases $(id="ingestAllDatabases")

If ticked, the workflow will be able to ingest all database in the cluster. If not ticked, the workflow will only ingest tables from the database set above.

### Ssl Mode $(id="sslMode")

SSL Mode to connect to redshift database. E.g, prefer, verify-ca etc.

### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
<!-- connectionOptions to be updated -->

### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
<!-- connectionArguments to be updated -->

### Supports Database $(id="supportsDatabase")

The source service supports the database concept in its hierarchy
<!-- supportsDatabase to be updated -->

