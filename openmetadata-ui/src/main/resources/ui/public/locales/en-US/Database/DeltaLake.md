# DeltaLake

In this section, we provide guides and references to use the Delta Lake connector.

## Requirements

The Delta Lake connector internally spins up a Spark Application (`pyspark` 3.X and `delta-lake` 2.0.0) to connect to your Hive Metastore and extract metadata from there.

You will need to make sure that the ingestion process can properly access the Metastore service or the database, and that your Metastore version is compatible with Spark 3.X.

You can find further information on the Delta Lake connector in the [docs](https://docs.open-metadata.org/connectors/database/deltalake).

## Connection Details

$$section
### Metastore Connection $(id="metastoreConnection")

You can choose 3 different ways for connecting to the Hive Metastore:
1. **Hive Metastore Service**: Thrift connection to the Metastore service. E.g., `localhost:9083`.
2. **Hive Metastore Database**: JDBC connection to the metastore database. E.g., `jdbc:mysql://localhost:3306/demo_hive`
3. **Hive Metastore File Path**: If during testing, you have a local `metastore.db` file.

$$

$$section
### Hive Metastore Service $(id="metastoreHostPort")

Here we need to inform the thrift connection to the Metastore service. E.g., `localhost:9083`.

This property will be used in the Spark Configuration under `hive.metastore.uris`. We are already adding the `thrift://` prefix, so you just need to inform the host and port.

$$

$$section
### Hive Metastore Database Connection $(id="metastoreDbConnection")

In this configuration we will be pointing to the Hive Metastore database directly.

#### Hive Metastore Database ($id="metastoreDb")

JDBC connection to the metastore database.

It should be a properly formatted database URL, which will be used in the Spark Configuration under `spark.hadoop.javax.jdo.option.ConnectionURL`.

#### Connection UserName ($id="username")

Username to use against the metastore database. The value will be used in the Spark Configuration under `spark.hadoop.javax.jdo.option.ConnectionUserName`.

#### Connection Password ($id="password")

Password to use against metastore database. The value will be used in the Spark Configuration under `spark.hadoop.javax.jdo.option.ConnectionPassword`.

#### Connection Driver Name ($id="driverName")

Driver class name for JDBC metastore. The value will be used in the Spark Configuration under `spark.hadoop.javax.jdo.option.ConnectionDriverName`,
e.g., `org.mariadb.jdbc.Driver`.

You will need to provide the driver to the ingestion image, and pass the Class path as explained below.

#### JDBC Driver Class Path ($id="jdbcDriverClassPath")

Class path to JDBC driver required for the JDBC connection. The value will be used in the Spark Configuration under `sparks.driver.extraClassPath`.

$$

$$section
### Hive Metastore File Path $(id="metastoreConnection")

Local path for the local file with metastore data. E.g., `/tmp/metastore.db`. This would only be applicable for local testing. Note that the path needs to be in the same host where the ingestion process takes place.

$$

$$section
### App Name $(id="appName")

Which name to give to the Spark Application that will run the ingestion.

$$

$$section
### Database Name $(id="databaseName")

In OpenMetadata, the Database Service hierarchy works as follows:

```
Database Service > Database > Schema > Table
```

In the case of Athena, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.

$$

$$section
### Connection Arguments $(id="connectionArguments")

Here you can specify any extra key-value pairs for the Spark Configuration.

$$
