# Oracle

In this section, we provide guides and references to use the Oracle connector.

## Requirements
To ingest metadata from Oracle, a user must have `CREATE SESSION` privilege.

```sql
-- CREATE USER
CREATE USER user_name IDENTIFIED BY admin_password;

-- CREATE ROLE
CREATE ROLE new_role;

-- GRANT ROLE TO USER
GRANT new_role TO user_name;

-- GRANT CREATE SESSION PRIVILEGE TO USER
GRANT CREATE SESSION TO new_role;
```

**Important:** To fetch metadata from Oracle database we use `python-oracledb`. This library only supports Oracle 12c, 18c, 19c and 21c versions!

You can find further information on the Oracle connector in the [docs](https://docs.open-metadata.org/connectors/database/oracle).

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
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

Host and port of the Oracle service.
$$

$$section
### Oracle Connection Type $(id="oracleConnectionType")

Connect with oracle by either passing service name or database schema name.
<!-- oracleConnectionType to be updated -->
$$

$$section
### Oracle Connection Type $(id="oracleConnectionType")

Connect with oracle by either passing service name or database schema name.
<!-- oracleConnectionType to be updated -->
$$

$$section
### Instant Client Directory $(id="instantClientDirectory")

This directory will be used to set the `LD_LIBRARY_PATH` env variable. It is required if you need to enable thick connection mode. By default, we bring instant client 19 and point to `/instantclient`.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
<!-- connectionOptions to be updated -->
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
<!-- connectionArguments to be updated -->
$$
