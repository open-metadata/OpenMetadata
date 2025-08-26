# Teradata

In this section, we provide guides and references to use the Teradata connector.

## Requirements

### Profiler & Data Quality

Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

You can find further information on the Teradata connector in the <a href="https://docs.open-metadata.org/connectors/database/teradata" target="_blank">docs</a>.

## Connection Details

$$section
### Connection Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Username $(id="username")

Username to connect to Teradata. By default, any valid user has privileges to read all the metadata in Teradata.
$$

$$section
### Password $(id="password")

Password to connect to Teradata.
$$

$$section
### Logon mechanism (Logmech) $(id="logmech")
Specifies the logon authentication method. Possible values are TD2 (the default), JWT, LDAP, KRB5 for Kerberos, or TDNEGO.

$$

$$section
### Extra data for the chosen logon authentication method (LOGDATA) $(id="logdata")

Specifies additional data needed by a logon mechanism, such as a secure token, Distinguished Name, or a domain/realm name. LOGDATA values are specific to each logon mechanism.
$$

$$section
### Host and Port $(id="hostPort")

This parameter specifies the host and port of the Teradata instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `example:1025`.
$$

$$section
### Transaction mode $(id="tmode")

Specifies the transaction mode for the connection. Possible values are DEFAULT (the default), ANSI, or TERA. More information about this parameter can be found <a href="https://teradata-docs.s3.amazonaws.com/doc/connectivity/jdbc/reference/current/jdbcug_chapter_2.html#TMODESEC" target="_blank">here</a> 
$$

$$section
### Teradata Database account $(id="account")

Specifies an account string to override the default account string defined for the database user. Accounts are used by the database for workload management and resource usage monitoring.

$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
You can find further information about Connection Arguments <a href="https://pypi.org/project/teradatasql/" target="_blank">here</a>.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
You can find further information about Connection Options <a href="https://pypi.org/project/teradatasql/" target="_blank">here</a>.
$$
