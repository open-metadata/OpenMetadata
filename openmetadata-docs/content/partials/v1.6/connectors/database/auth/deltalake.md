#### Connection Details For MetastoreConfig

- **Metastore Host Port**: Enter the Host & Port of Hive Metastore Service to configure the Spark Session. Either
  of `metastoreHostPort`, `metastoreDb` or `metastoreFilePath` is required.
- **Metastore File Path**: Enter the file path to local Metastore in case Spark cluster is running locally. Either
  of `metastoreHostPort`, `metastoreDb` or `metastoreFilePath` is required.
- **Metastore DB**: The JDBC connection to the underlying Hive metastore DB. Either
  of `metastoreHostPort`, `metastoreDb` or `metastoreFilePath` is required.
- **appName (Optional)**: Enter the app name of spark session.
- **Connection Arguments (Optional)**: Key-Value pairs that will be used to pass extra `config` elements to the Spark Session builder.

We are internally running with `pyspark` 3.X and `delta-lake` 2.0.0. This means that we need to consider Spark configuration options for 3.X.

**Metastore Host Port**

When connecting to an External Metastore passing the parameter `Metastore Host Port`, we will be preparing a Spark Session with the configuration

```
.config("hive.metastore.uris", "thrift://{connection.metastoreHostPort}")
```

Then, we will be using the `catalog` functions from the Spark Session to pick up the metadata exposed by the Hive Metastore.

**Metastore File Path**

If instead we use a local file path that contains the metastore information (e.g., for local testing with the default `metastore_db` directory), we will set

```
.config("spark.driver.extraJavaOptions", "-Dderby.system.home={connection.metastoreFilePath}")
```

To update the `Derby` information. More information about this in a great [SO thread](https://stackoverflow.com/questions/38377188/how-to-get-rid-of-derby-log-metastore-db-from-spark-shell).

- You can find all supported configurations [here](https://spark.apache.org/docs/latest/configuration.html)
- If you need further information regarding the Hive metastore, you can find it [here](https://spark.apache.org/docs/latest/sql-data-sources-hive-tables.html),
  and in The Internals of Spark SQL [book](https://jaceklaskowski.gitbooks.io/mastering-spark-sql/content/spark-sql-hive-metastore.html).

**Metastore Database**

You can also connect to the metastore by directly pointing to the Hive Metastore db, e.g., `jdbc:mysql://localhost:3306/demo_hive`.

Here, we will need to inform all the common database settings (url, username, password), and the driver class name for JDBC metastore.

You will need to provide the driver to the ingestion image, and pass the `classpath` which will be used in the Spark Configuration under `spark.driver.extraClassPath`.

#### Connection Details for StorageConfig - S3

{% partial file="/v1.6/connectors/database/aws.md" /%}