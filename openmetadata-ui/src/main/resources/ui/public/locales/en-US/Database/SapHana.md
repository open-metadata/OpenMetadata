# SAP Hana

In this section, we provide guides and references to use the SAP Hana connector.

## Requirements

The connector is compatible with HANA or HANA express versions since HANA SPS 2.

To extract metadata the user used in the connection needs to have access to the `SYS` schema.

You can create a new user to run the ingestion with:

```SQL
CREATE USER openmetadata PASSWORD Password123;
```

And, if you have password policies forcing users to reset the password, you can disable that policy for this technical user with:

```SQL
ALTER USER openmetadata DISABLE PASSWORD LIFETIME;
```

### Profiler & Data Quality

Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. The user should also be allowed to view information in `tables` for all objects in the database. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

You can find further information on the SAP Hana connector in the <a href="https://docs.open-metadata.org/connectors/database/sap-hana" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. We only support `hana`, which is based on `hdbcli`.
$$

$$section
### Connection $(id="connection")
We support two possible connection types:
1. **SQL Connection**, where you will the username, password and host.
2. **HDB User Store** <a href="https://help.sap.com/docs/SAP_HANA_PLATFORM/b3ee5778bc2e4a089d3299b82ec762a7/dd95ac9dbb571014a7d7f0234d762fdb.html?version=2.0.05&locale=en-US" target="_blank">connection</a>. Note that the HDB Store will need to be locally available to the instance running the ingestion process. If you are unsure about this setting, you can run the ingestion process passing the usual SQL connection details.
$$

## SQL Connection

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the SAP Hana instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:39041`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:39041` as the value.
$$

$$section
### Username $(id="username")
Username to connect to SAP Hana. This user should have access to the `SYS` schema to extract metadata. Other workflows may require different permissions. Refer to the section above for more information.
$$

$$section
### Password $(id="password")
Password for the informed user.
$$


$$section
### Database $(id="database")
Database you want to connect to. If this is not informed, we will use the default's user database.
$$

$$section
### Database Schema $(id="databaseSchema")
This is an optional parameter. When set, the value will be used to restrict the metadata reading to a single schema (corresponding to the value passed in this field). When left blank, OpenMetadata will scan all the schemas.
$$

## HDB User Store

$$section
### User Key $(id="userKey")
HDB Store User Key generated from the command `hdbuserstore SET <KEY> <host:port> <USERNAME> <PASSWORD>`.
$$

---

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to the service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to the service during connection.
$$
